import express from "express";
import mongoose from "mongoose";
import getMeal from "./llm.js";
import User from "./UserDetails.js";
import { getGroqChatCompletion } from "./chatllm.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import Tesseract from "tesseract.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hugging Face API token for Whisper
const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_TOKEN;

const app = express();
app.use(express.json());

// MongoDB connection URL from environment variables
const mongourl = process.env.MONGO_URI;

// MongoDB Connection
mongoose.connect(mongourl)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Failed to connect to MongoDB:", err));

// Function to calculate nutritional needs
function calculateNutritionalNeeds(userData) {
  // Placeholder function for calculating nutritional needs
  return {
    calories: 2000,
    protein: 50,
    carbs: 300,
    fats: 70
  };
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Register route to handle user registration and meal plan generation
app.post('/register', async (req, res) => {
  try {
    // Destructure user data from the request body
    const { 
      uid, phoneNo, email, name, age, weight, height, gender, 
      healthIssues, allergies, cuisines, goal, doctorNo, extraInfo, 
      birthDate, activityLevel, dietaryRestrictions, mealPreferences 
    } = req.body;

    console.log("Received data:", req.body);

    // Validation to ensure required fields are present
    if (!uid || !email || !name || !age || !weight || !height || !gender) {
      return res.status(400).send({ status: "error", message: "Missing required fields" });
    }

    // Check if the user already exists
    const oldUser = await User.findOne({ $or: [{ email: email }, { uid: uid }] });
    if (oldUser) {
      return res.status(409).send({ status: "error", message: "User already exists!" });
    }

    // Generate initial meal plan with nutritional needs
    console.log("Generating meal plan and calculating nutritional needs...");
    let mealPlanResponse;
    try {
      mealPlanResponse = await getMeal({ 
        age, weight, height, gender, healthIssues, allergies, cuisines, 
        goal, activityLevel, dietaryRestrictions, mealPreferences 
      });

      if (!mealPlanResponse || !mealPlanResponse.mealPlan) {
        throw new Error("Meal plan generation failed");
      }

      console.log("Meal plan generated successfully with nutritional calculations.");
    } catch (error) {
      return res.status(500).send({ 
        status: "error", 
        message: "Meal plan generation failed", 
        error: error.message 
      });
    }

    // Extract meal plan and nutritional needs from response
    const { mealPlan, nutritionalNeeds } = mealPlanResponse;

    // Create or update the user record with complete information
    const createdUser = await User.findOneAndUpdate(
      { uid: uid }, 
      { 
        phoneNo,
        email, 
        name,
        age,
        weight,
        height,
        gender,
        healthIssues,
        allergies,
        cuisines,
        goal,
        doctorNo,
        extraInfo,
        birthDate,
        activityLevel,
        dietaryRestrictions,
        mealPreferences,
        mealPlan,
        nutritionalNeeds: {
          ...nutritionalNeeds,
          lastCalculated: new Date()
        },
        lastMealPlanUpdate: new Date()
      },
      { new: true, upsert: true }
    );

    console.log("User created successfully with nutritional information");

    // Respond with success message and complete data
    res.status(201).send({ 
      status: "ok", 
      message: "User Created with Meal Plan and Nutritional Needs",
      data: {
        user: {
          uid: createdUser.uid,
          name: createdUser.name,
          email: createdUser.email
        },
        mealPlan: createdUser.mealPlan,
        nutritionalNeeds: createdUser.nutritionalNeeds
      }
    });

  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send({ 
      status: "error", 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
});


// Fetch user details and meal plan
app.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// Update user details
app.put('/update/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;

    // Find and update user, excluding mealPlan from the update
    const { mealPlan, ...dataToUpdate } = updateData;
    
    const updatedUser = await User.findOneAndUpdate(
      { uid },
      dataToUpdate,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    res.status(200).json({ status: "ok", message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error", error: error.message });
  }
});


// Chat endpoint
app.post('/chat/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ 
        status: "error", 
        message: "Message is required" 
      });
    }

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ 
        status: "error", 
        message: "User not found" 
      });
    }

    const response = await getGroqChatCompletion(message, user);

    if (!response.success) {
      return res.status(500).json({ 
        status: "error", 
        message: response.error 
      });
    }

    res.json({ 
      status: "ok", 
      reply: response.response,
      type: response.type 
    });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to process chat request" 
    });
  }
});

// Image upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: "error", 
        message: "No file uploaded" 
      });
    }

    // Get extracted text from OCR
    const result = await Tesseract.recognize(req.file.path, 'eng');
    const extractedText = result.data.text.trim();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Get analysis from LLM
    const analysis = await getGroqChatCompletion(
      `Analyze this medical document: ${extractedText}`,
      req.user
    );

    if (!analysis.success) {
      throw new Error(analysis.error);
    }

    res.json({
      status: "ok",
      extractedText,
      analysis: analysis.response,
      type: 'imageAnalysis'
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process image"
    });
  }
});

//update meal plan endpoint 
app.put('/update-meal-plan/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { mealPlan } = req.body;

    if (!mealPlan) {
      return res.status(400).json({ 
        status: "error", 
        message: "Meal plan is required" 
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { uid },
      { mealPlan },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        status: "error", 
        message: "User not found" 
      });
    }

    res.status(200).json({ 
      status: "ok", 
      message: "Meal plan updated successfully", 
      user: updatedUser 
    });

  } catch (error) {
    console.error("Error updating meal plan:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Internal Server Error" 
    });
  }
});


const PORT = process.env.PORT || 5001; // Use Render's assigned port or default to 5001 locally

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
