// UserDetails.js (ES module syntax)
import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timing: { type: String, required: true },
  dosage: { type: String, required: true },
  withFood: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  phoneNo: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  weight: { type: Number, required: true },
  height: { type: Number, required: true },
  gender: { type: String, required: true },
  healthIssues: { type: String },
  allergies: { type: String },
  cuisines: { type: String },
  goal: { type: String },
  doctorNo: { type: String, required: true },
  extraInfo: { type: String },
  birthDate: { type: String },
  activityLevel: { type: String },
  dietaryRestrictions: { type: String },
  mealPreferences: { type: String },
  mealPlan: { type: Object },
  medications: [medicationSchema],

  nutritionalNeeds: {
    bmr: Number,
    tdee: Number,
    targetCalories: Number,
    macroTargets: {
      protein: Number,
      carbs: Number,
      fats: Number,
      fiber: Number
    },
    mealDistribution: {
      breakfast: Number,
      lunch: Number,
      snacks: Number,
      dinner: Number
    },
    lastCalculated: Date
  }
});

// Add middleware to calculate nutritional needs
userSchema.pre('save', function(next) {
  if (this.isModified('weight') || 
      this.isModified('height') || 
      this.isModified('age') || 
      this.isModified('activityLevel') || 
      this.isModified('goal')) {
    
    const { calculateNutritionalNeeds } = require('./utils/nutritionCalculator');
    const needs = calculateNutritionalNeeds(this);
    this.nutritionalNeeds = {
      ...needs,
      lastCalculated: new Date()
    };
  }
  next();
});

// Export the model as a default export
export default mongoose.model('personal_details', userSchema);
