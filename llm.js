import Groq from "groq-sdk";
import dotenv from 'dotenv';
import { calculateNutritionalNeeds } from './utils/nutritionCalculator.js';

// Load environment variables
dotenv.config();

// Add error handling for missing API key
if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set in environment variables');
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function getGroqChatCompletion(userDetails) {
  try {
    // Calculate comprehensive nutritional needs
    const nutritionalNeeds = {
      ...calculateNutritionalNeeds(userDetails),
      lastCalculated: new Date()
    };

    // Ensure all required properties exist
    const macroTargets = {
      protein: nutritionalNeeds.macroTargets?.protein || Math.round(userDetails.weight * 1.2),
      carbs: nutritionalNeeds.macroTargets?.carbs || Math.round(nutritionalNeeds.targetCalories * 0.45 / 4),
      fats: nutritionalNeeds.macroTargets?.fats || Math.round(nutritionalNeeds.targetCalories * 0.30 / 9),
      fiber: nutritionalNeeds.macroTargets?.fiber || 25
    };

    // Calculate meal distribution if not present
    const mealDistribution = {
      breakfast: Math.round(nutritionalNeeds.targetCalories * 0.25),
      lunch: Math.round(nutritionalNeeds.targetCalories * 0.30),
      snacks: Math.round(nutritionalNeeds.targetCalories * 0.15),
      dinner: Math.round(nutritionalNeeds.targetCalories * 0.30)
    };

    // Update nutritionalNeeds with complete data
    nutritionalNeeds.macroTargets = macroTargets;
    nutritionalNeeds.mealDistribution = mealDistribution;

    const prompt = `
      You are a professional nutrition guide who creates meal plans for elders.

      📊 CALCULATED NUTRITIONAL NEEDS:
      BMR: ${nutritionalNeeds.bmr} kcal/day
      TDEE: ${nutritionalNeeds.tdee} kcal/day
      Daily Target Calories: ${nutritionalNeeds.targetCalories} kcal

      📌 MACRO TARGETS:
      Protein: ${macroTargets.protein}g (${Math.round(macroTargets.protein * 4)} kcal)
      Carbs: ${macroTargets.carbs}g (${Math.round(macroTargets.carbs * 4)} kcal)
      Fats: ${macroTargets.fats}g (${Math.round(macroTargets.fats * 9)} kcal)
      Fiber: ${macroTargets.fiber}g

      🕒 MEAL DISTRIBUTION:
      Breakfast: ${mealDistribution.breakfast} kcal
      Lunch: ${mealDistribution.lunch} kcal
      Snacks: ${mealDistribution.snacks} kcal
      Dinner: ${mealDistribution.dinner} kcal

      🏥 MEDICATIONS:
      ${userDetails.medications?.map(med => 
        `- ${med.name} (${med.dosage}) - Take ${med.timing}${med.withFood ? ' with food' : ''}`
      ).join('\n') || 'No medications listed'}

      Generate a full weekly meal plan (Sunday to Saturday) based on the following user details:

      Age: ${userDetails.age}
      Weight: ${userDetails.weight} kg
      Height: ${userDetails.height} cm
      Gender: ${userDetails.gender}
      Health Issues: ${userDetails.healthIssues}
      Allergies: ${userDetails.allergies}
      Meal Preferences: ${userDetails.mealPreferences}
      Dietary Restrictions: ${userDetails.dietaryRestrictions}
      Goal: ${userDetails.goal}
      Activity Level: ${userDetails.activityLevel}
      Cuisine Preferences: ${userDetails.cuisines}

      **Additional Requirements:**
      - Consider medication timings and requirements (with/without food)
      - Schedule meals around medication timings
      - Avoid food interactions with medications
      - Ensure appropriate gaps between medications and meals when required
      - Include specific nutrients that support medication absorption when needed
      - Account for any dietary restrictions due to medications

      **Return only JSON output, without any additional text.** The JSON structure should be:

      {
        "week": [
          {
            "day": "Sunday",
            "meals": [
              {
                "mealType": "Breakfast",
                "meal": "Meal name",
                "recipe": "Recipe instructions",
                "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
                "nutritionalInfo": {
                  "calories": "Calories",
                  "protein": "Protein",
                  "carbs": "Carbohydrates",
                  "fat": "Fat",
                  "fiber": "Fiber"
                },
                "servingSize": "Serving Size",
                "mealTime": "Meal Time"
              }
            ]
          }
        ]
      }
    `;

    // Make API request to Groq LLM
    const response = await groq.chat.completions.create({
      messages: [{ 
        role: "user", 
        content: prompt 
      }],
      model: "llama-3.3-70b-versatile",
    });

    let output = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const mealPlan = JSON.parse(jsonMatch[0]);
      // Include initial nutritional needs calculation
      return {
        mealPlan,
        nutritionalNeeds,
        type: 'initialPlan' // Add type to identify initial meal plan creation
      };
    } else {
      console.error("LLM Response (invalid JSON):", output);
      throw new Error("Invalid JSON output from LLM");
    }
  } catch (error) {
    console.error("Error fetching meal plan:", error.message);
    return { error: "Failed to generate meal plan." };
  }
}

export default async function getMeal(userDetails) {
  const result = await getGroqChatCompletion(userDetails);
  console.log('Generated Meal Plan:', result);
  return result;
}
