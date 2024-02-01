const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const csvParser = require('csv-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();
const port = 8080;
const mongoose = require('mongoose');


app.use(bodyParser.json());
app.use(cors());
// Set up Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ dest: 'uploads/' }); 

const uri = 'mongodb+srv://chaitanyapawar410:chaitanya04@cluster0.nlaldan.mongodb.net/';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });

  app.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
  
    // Validation: Check if required fields are present
    if (!username ||!email|| !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
  
    // Access the database and find the user
    try {
      const database = client.db('users'); 
      const collection = database.collection('users_data'); 
  
      const user = await collection.findOne({ username, email, password });
  
      // Check if user exists
      if (user) {
        // Authentication successful
        res.status(200).json({ message: 'Login successful', userId: user._id });
      } else {
        // User not found or incorrect credentials
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Error searching for user in the database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/signup', async (req, res) => {
    const { username, email, password, usertype, companyname, businessDescription } = req.body;
  
    // Validation: Check if required fields are present
    if (!username || !email || !password || !usertype) {
      return res.status(400).json({ error: 'Username, email, password, and usertype are required' });
    }
  
    // Create a user object with optional fields
    const user = {
      username,
      email,
      password,
      usertype,
      companyname: companyname || null,
      businessDescription: businessDescription || null,
    };
  
    // Access the database and insert the user
    try {
      const database = client.db('users'); 
      const collection = database.collection('users_data'); 
  
      const result = await collection.insertOne(user);
  
      // Send a response indicating success
      res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (error) {
      console.error('Error inserting user into database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

app.get('/usertype', async (req, res) => {
  const { username } = req.query;

  // Validation: Check if username is present
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Access the database and find the user by username
  try {
    const database = client.db('users');
    const collection = database.collection('users_data');

    const user = await collection.findOne({ username });

    // Check if user exists
    if (user) {
      res.status(200).json({ usertype: user.usertype });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error searching for user in the database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/startups', async (req, res) => {
  try {
    const database = client.db('users');
    const collection = database.collection('users_data');

    // Fetch details of startups (users with usertype 'startup')
    const startups = await collection.find({ usertype: 'startup' }).toArray();

    // Check if startups exist
    if (startups.length > 0) {
      // Extract relevant details and interested_investors array
      const startupDetails = startups.map(startup => ({
        username: startup.username,
        companyname: startup.companyname,
        businessDescription: startup.businessDescription,
        interested_investors: startup.interested_investors || [], // Include interested_investors array
        // Add more fields as needed
      }));

      res.status(200).json({ startups: startupDetails });
    } else {
      res.status(404).json({ error: 'No startups found' });
    }
  } catch (error) {
    console.error('Error fetching startups from the database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/interested', async (req, res) => {
  const { startupUsername, investorEmail } = req.body;

  // Validation: Check if required fields are present
  if (!startupUsername || !investorEmail) {
    return res.status(400).json({ error: 'startupUsername and investorEmail are required' });
  }

  try {
    const database = client.db('users');
    const collection = database.collection('users_data');

    // Find the startup by username
    const startup = await collection.findOne({ username: startupUsername, usertype: 'startup' });

    // Check if startup exists
    if (startup) {
      // Check if the interested_investors array exists, if not, create it
      if (!startup.interested_investors) {
        startup.interested_investors = [];
      }

      // Check if the investor is already in the array
      const isInvestorAlreadyInterested = startup.interested_investors.some(
        investor => investor.email === investorEmail
      );

      if (!isInvestorAlreadyInterested) {
        // Add investor details to the array
        startup.interested_investors.push({ email: investorEmail });

        // Update the startup document in the collection
        await collection.updateOne({ _id: startup._id }, { $set: { interested_investors: startup.interested_investors } });

        res.status(200).json({ message: 'Investor added to interested_investors array successfully' });
      } else {
        res.status(400).json({ error: 'Investor is already in the interested_investors array' });
      }
    } else {
      res.status(404).json({ error: 'Startup not found' });
    }
  } catch (error) {
    console.error('Error handling investor interest:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/upload', upload.single('salesData'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Process the CSV file using csv-parser
    const results = [];
    const parser = require('streamifier').createReadStream(file.buffer).pipe(csvParser());
    for await (const record of parser) {
      results.push(record);
    }

    // Here, you can insert the processed data into your MongoDB or perform other operations
    console.log('Processed CSV data:', results);

    res.status(200).json({ message: 'File uploaded and processed successfully.' });
  } catch (error) {
    console.error('Error during file processing:', error);
    res.status(500).json({ error: 'Error processing the CSV file.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
