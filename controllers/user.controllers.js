const express = require('express');
const app = express();
const User = require('../models/User.js');
const Place = require('../models/Place.js');
const Booking = require('../models/Booking.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const { ObjectAlreadyInActiveTierError, ExpressionType } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const { resolve } = require('path');
const dotenv = require('dotenv');

dotenv.config();



const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.jwtSecret;
// console.log("jwtSecret: ",jwtSecret);

function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    });
}

module.exports.test = (req, res) => {
    res.json(' api is working ');
};

module.exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const user = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        // console.log("registered ");

        res.status(200).json(user);
    } catch (error) {
        res.status(422).json(error);
    }

};

module.exports.login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user) {
        const passOk = bcrypt.compareSync(password, user.password);
        if (passOk) {
            jwt.sign({
                email: user.email,
                id: user._id
            }, jwtSecret, (err, token) => {
                if (err) {
                    // console.log("error");
                    throw err;
                }
                res.cookie('token', token).json({
                    success: true,
                    message: "Login successful",
                    user
                });
            });
        }
        else {
            res.status(422).json({
                success: false,
                message: "Password is wrong ",
            });
        }
    }
    else {
        res.status(404).json({
            success: false,
            message: "User not found "
        });
    }
};

module.exports.profile = (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, tokenData) => {
            if (err) throw err;
            const { name, email, _id } = await User.findById(tokenData.id);
            res.json({ name, email, _id });
        });
    }
    else {
        res.json(null);
    }
};

module.exports.logout = (req, res) => {
    res.cookie('token', '').json(true);
};

module.exports.uploadByLink = async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/' + newName,
    });
    const pth = 'http://localhost:4000/uploads/' + newName;
    res.json(pth);
};



module.exports.upload = (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('/uploads', ''));
    }
    res.json(uploadedFiles);
    // console.log(req.files);
};

module.exports.addPlace = async (req, res) => {
    const { token } = req.cookies;
    const { title, address, addedPhotos,
        description, perks, extraInfo, checkIn, checkOut, maxGuests, price,
    } = req.body;

    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) {
            // console.log("error");
            throw err;
        }
        const PlaceDoc = await Place.create({
            owner: userData.id,
            title, address, photos: addedPhotos,
            description, perks, extraInfo,
            checkIn, checkOut, maxGuests, price,
        });
        res.json(PlaceDoc);
    });
};

module.exports.myPlaces = async (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const { id } = userData;
        res.json(await Place.find({ owner: id }));
    });
};

module.exports.place = async (req, res) => {
    const { id } = req.params;
    res.json(await Place.findById(id));
};

module.exports.updatePlace = async (req, res) => {
    const { token } = req.cookies;
    const { id, title, address, addedPhotos,
        description, perks, extraInfo, checkIn, checkOut, maxGuests, price,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title, address, photos: addedPhotos,
                description, perks, extraInfo,
                checkIn, checkOut, maxGuests, price,
            });
            await placeDoc.save();
            res.json('ok');
        }
    });
};

module.exports.places = app.get('/places', async (req, res) => {
    res.json(await Place.find());
});

module.exports.addBooking = async (req, res) => {
    // console.log("enter");
    const { token } = req.cookies;
    if (!token || token.length === 0) return (res.status(505).json({
        success: false,
        message: "Login First"
    }));
    // console.log("token-: ",token);
    const userData = await getUserDataFromReq(req);
    const { place, checkIn, checkOut,
        name, numberOfGuests, phone, price } = req.body;
    Booking.create({
        place, checkIn, checkOut, numberOfGuests,
        phone, price, name, user: userData.id,
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        throw err;
    });
};


module.exports.bookings = async (req, res) => {

    try {
        const userData = await getUserDataFromReq(req);
        //  console.log(userData);
        const doc = await Booking.find({ user: userData.id }).populate('place');
        // console.log("Enter-> ",doc);
        res.json(doc);
    } catch (error) {
        res.status(505).json({
            success: false,
            message: "Login first"
        });
    }

    // res.json(await Booking.find({user:userData.id}).populate('place'));
};
