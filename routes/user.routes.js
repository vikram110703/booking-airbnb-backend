const express = require('express');
const multer = require('multer');

const {
    test, register, login, profile, logout,
    uploadByLink, upload, addPlace,
    myPlaces, place, updatePlace, places,
    addBooking, bookings,
} = require("../controllers/user.controllers.js");

const router = express.Router();

const photosMiddleware = multer({ dest: 'uploads/' });

router.get("/test", test);
router.post('/register', register);
router.post("/login", login);
router.get("/profile", profile); // Add a forward slash at the beginning
router.post('/logout', logout);
router.post('/upload', photosMiddleware.array('photos', 100), upload);
router.post('/upload-by-link', uploadByLink);
router.post('/places', addPlace);
router.get("/user-places", myPlaces);
router.get("/places/:id", place);
router.put("/places/:id", updatePlace);
router.get("/places", places);
router.post("/bookings", addBooking);
router.get("/bookings", bookings);

module.exports = router;
