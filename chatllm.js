import Groq from "groq-sdk";
import dotenv from "dotenv";
import { calculateNutritionalNeeds } from './utils/nutritionCalculator.js';

dotenv.config();

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY
});

// 📅 Format Meal Plan Data
function formatMealPlan(mealPlan) {
  if (!mealPlan?.week) return "No meal plan available.";

  return mealPlan.week.map(day => {
    const mealsText = day.meals.map(meal => {
      return `- 🍽️ ${meal.mealType}: ${meal.meal} at ${meal.mealTime}
        📝 Recipe: ${meal.recipe}
        🥗 Ingredients: ${meal.ingredients.join(", ")}
        🔍 Nutrition: ${meal.nutritionalInfo.calories} kcal, 
        Protein: ${meal.nutritionalInfo.protein}, 
        Carbs: ${meal.nutritionalInfo.carbs}, 
        Fat: ${meal.nutritionalInfo.fat}, 
        Fiber: ${meal.nutritionalInfo.fiber}
        📏 Serving Size: ${meal.nutritionalInfo.servingSize}`;
    }).join("\n");

    return `📅 **${day.day}:**\n${mealsText}`;
  }).join("\n\n");
}

// 📅 Get Today's Meals
function getTodaysMeals(mealPlan) {
  if (!mealPlan?.week) return "No meal plan available.";
  const today = new Date().toLocaleString('en-US', { weekday: 'long' });
  const todayData = mealPlan.week.find(day => day.day === today);
  if (!todayData) return `No meal plan found for today (${today}).`;
  return formatMealPlan({ week: [todayData] });
}

// 📊 Format Weekly Reports
function formatWeeklyReports(reports) {
  if (!reports || reports.length === 0) return "No weekly reports available.";

  return reports.slice(-4).map(report => {
    return `📊 **Report Date: ${new Date(report.date).toLocaleDateString()}**
    😊 Overall Feeling: ${report.overallFeeling}/5
    ⚡ Energy Levels: ${report.energyLevels}/5
    😴 Sleep Quality: ${report.sleepQuality}/5
    😓 Stress Levels: ${report.stressLevels}/5
    🍽️ Diet Adherence: ${report.dietAdherence}/5
    🏃 Physical Activity: ${report.physicalActivity}/5
    🚽 Digestive Health: ${report.digestiveHealth}/5
    
    📝 Challenges: ${report.challenges || 'None reported'}
    ✨ Improvements: ${report.improvements || 'None reported'}
    📌 Notes: ${report.notes || 'No additional notes'}`;
  }).join('\n\n');
}

// 🔄 Handle Meal Modification Requests
async function handleMealModification(userMessage, userDetails) {
  try {
    // Calculate nutritional needs
    const nutritionalNeeds = calculateNutritionalNeeds(userDetails);

    const modificationPrompt = `
${userDetails.name || "User"}, you are a nutrition expert specializing in elderly care.

📊 NUTRITIONAL TARGETS:
BMR: ${nutritionalNeeds.bmr} kcal/day
TDEE: ${nutritionalNeeds.tdee} kcal/day
Daily Target: ${nutritionalNeeds.targetCalories} kcal

📌 MACRO DISTRIBUTION:
Protein: ${nutritionalNeeds.macroTargets.protein}g
Carbs: ${nutritionalNeeds.macroTargets.carbs}g
Fats: ${nutritionalNeeds.macroTargets.fats}g
Fiber: ${nutritionalNeeds.macroTargets.fiber}g

🕒 MEAL DISTRIBUTION:
Breakfast: ${nutritionalNeeds.mealDistribution.breakfast} kcal
Lunch: ${nutritionalNeeds.mealDistribution.lunch} kcal
Snacks: ${nutritionalNeeds.mealDistribution.snacks} kcal
Dinner: ${nutritionalNeeds.mealDistribution.dinner} kcal

📌 MODIFICATION REQUEST:
${userMessage}

📌 CURRENT USER CONTEXT:
${JSON.stringify(userDetails, null, 2)}

Generate meal modifications that:
1. Match the calculated nutritional needs
2. Follow all dietary restrictions
3. Consider health conditions
4. Maintain nutritional balance
5. Use preferred cuisines
6. Are easy to prepare

Return ONLY JSON in this format:
{
  "modifications": {
    "reasoning": "Explanation based on health data",
    "focusAreas": ["area1", "area2"],
    "nutritionalGoals": {
      "bmr": ${nutritionalNeeds.bmr},
      "tdee": ${nutritionalNeeds.tdee},
      "targetCalories": ${nutritionalNeeds.targetCalories},
      "macroTargets": ${JSON.stringify(nutritionalNeeds.macroTargets)}
    },
    "changes": [{
      "day": "Day name",
      "mealType": "Meal type",
      "currentMeal": "Current meal name",
      "newMeal": {
        "meal": "New meal name",
        "recipe": "Recipe instructions",
        "ingredients": ["ingredient1", "ingredient2"],
        "nutritionalInfo": {
          "calories": "xxx kcal",
          "protein": "xx g",
          "carbs": "xx g",
          "fat": "xx g",
          "fiber": "xx g"
        },
        "servingSize": "serving size",
        "mealTime": "suggested time"
      }
    }]
  }
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: modificationPrompt },
        { role: "user", content: userMessage }
      ]
    });

    return {
      type: 'mealModification',
      content: JSON.parse(response.choices[0].message.content),
      nutritionalNeeds: {
        ...nutritionalNeeds,
        lastCalculated: new Date()
      }
    };
  } catch (error) {
    console.error("Error in meal modification:", error);
    return {
      type: 'error',
      content: "Failed to process meal modification request"
    };
  }
}

// Update the image analysis handler
async function handleImageAnalysis(message, user) {
  try {
    const extractedText = message.replace('Analyze this medical document:', '').trim();
    
    const analysisPrompt = `You are a medical document analyzer. Analyze this medical document${user?.name ? ` for ${user.name}` : ''}.
${user?.age ? `Patient Age: ${user.age}` : ''}
${user?.healthIssues ? `Health Context: ${user.healthIssues}` : ''}
${user?.allergies ? `Allergies: ${user.allergies}` : ''}

Please analyze and provide insights about:
1. Key health indicators
2. Test results and their meanings
3. Any concerning values
4. Recommended actions
5. Follow-up suggestions

Document text: ${extractedText}`;

    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: analysisPrompt },
        { role: "user", content: "Please analyze this medical document and provide a clear, structured report." }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return {
      success: true,
      response: chatCompletion.choices[0]?.message?.content || "No analysis generated",
      type: 'imageAnalysis'
    };

  } catch (error) {
    console.error("Image analysis error:", error);
    return {
      success: false,
      error: "Failed to analyze image content",
      details: error.message
    };
  }
}

// ✅ Export Function
export async function getGroqChatCompletion(userMessage, user) {
  try {
    if (!groq || !groq.chat) throw new Error("Groq API client not initialized");
    if (!userMessage) throw new Error("No message provided");

    const sanitizedMessage = String(userMessage).trim();
    if (!sanitizedMessage) throw new Error("Empty message");

    // Check if this is an image analysis request
    if (sanitizedMessage.startsWith('Analyze this medical document:')) {
      return await handleImageAnalysis(sanitizedMessage, user);
    }

    // Check if this is a meal modification request
    if (sanitizedMessage.toLowerCase().includes('change meal') || 
        sanitizedMessage.toLowerCase().includes('modify meal')) {
      return await handleMealModification(sanitizedMessage, user);
    }

    // Format context for general chat
    const context = `
User Profile:
- Name: ${user.name || 'User'}
- Age: ${user.age}
- Health Issues: ${user.healthIssues || 'None'}
- Allergies: ${user.allergies || 'None'}
- Diet Restrictions: ${Array.isArray(user.dietaryRestrictions) ? 
    user.dietaryRestrictions.join(', ') : (user.dietaryRestrictions || 'None')}

Today's Meals:
${getTodaysMeals(user.mealPlan)}

Recent Health Updates:
${formatWeeklyReports(user.weeklyReports)}
    `;

    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful nutrition assistant. Provide clear, specific answers based on the user's profile and meal plan." },
        { role: "user", content: `Context: ${context}\n\nQuestion: ${sanitizedMessage}` }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    return {
      success: true,
      response: chatCompletion.choices[0]?.message?.content || "No response generated",
      type: 'chat'
    };

  } catch (error) {
    console.error("Chat Error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate response",
      type: 'error'
    };
  }
}

export default getGroqChatCompletion;
