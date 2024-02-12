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
const routes=require('./routes/user.routes.js');


dotenv.config();

//middlewares 
app.use(cors(
  {
    credentials: true,
    origin: [process.env.Frontend_URL, 'http://localhost:5173',"*"]
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

app.use('/',routes);
app.get("*",(req,res)=>{
  res.send("404 not found");
});



app.listen(process.env.PORT, () => {
  console.log(`Server is running at port ${process.env.PORT} `);
});