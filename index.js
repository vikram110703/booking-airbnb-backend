const express = require('express');
const app = express();
const cors = require('cors');
const db = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const { ObjectAlreadyInActiveTierError } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const { resolve } = require('path');


dotenv.config();

//middlewares 
app.use(cors(
  {
    credentials: true,
    origin: [process.env.Frontend_URL, 'http://localhost:5173'],
  }
));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

try {
  db.connect(process.env.MONGO_URL, () => {
    console.log("Database is connected ");
  })
} catch (error) {
  console.log(error);
}

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.jwtSecret;

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get('/test', (req, res) => {
  res.json(' api is working ');
});
app.post('/register', async (req, res) => {
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

});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const passOk = bcrypt.compareSync(password, user.password);
    if (passOk) {
      jwt.sign({
        email: user.email,
        id: user._id
      }, jwtSecret, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          success: true,
          message: "Login successful"
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
});

app.get('/profile', (req, res) => {
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
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json(true);
});

app.post('/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await imageDownloader.image({
    url: link,
    dest: __dirname + '/uploads/' + newName,
  });
  const pth = 'http://localhost:4000/uploads/' + newName;
  res.json(pth);
});


const photosMiddleware = multer({ dest: 'uploads/' });
app.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
  const uploadeddFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
    uploadeddFiles.push(newPath.replace('/uploads', ''));
  }
  res.json(uploadeddFiles);
  // console.log(req.files);
});

app.post('/places', async (req, res) => {
  const { token } = req.cookies;
  const { title, address, addedPhotos,
    description, perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const PlaceDoc = await Place.create({
      owner: userData.id,
      title, address, photos: addedPhotos,
      description, perks, extraInfo,
      checkIn, checkOut, maxGuests, price,
    });
    res.json(PlaceDoc);
  });
});

app.get('/user-places', async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get('/places/:id', async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put('/places/:id', async (req, res) => {
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
});

app.get('/places', async (req, res) => {
  res.json(await Place.find());
});

app.post('/bookings', async (req, res) => {
  // console.log("enter");
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
});


app.get('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  //  console.log(userData.id);
  const doc = await Booking.find({ user: userData.id }).populate('place');
  // console.log("Enter-> ",doc);
  res.json(doc);
  // res.json(await Booking.find({user:userData.id}).populate('place'));
});







app.listen(4000, () => {
  console.log("Server is running at port 4000");
});