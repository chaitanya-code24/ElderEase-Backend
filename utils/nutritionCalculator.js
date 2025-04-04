export function calculateNutritionalNeeds(user) {
  // Calculate BMR using Mifflin-St Jeor Equation
  const bmr = user.gender.toLowerCase() === 'male'
    ? (10 * user.weight) + (6.25 * user.height) - (5 * user.age) + 5
    : (10 * user.weight) + (6.25 * user.height) - (5 * user.age) - 161;

  // Activity level multipliers
  const activityMultipliers = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very active': 1.9
  };

  const multiplier = activityMultipliers[user.activityLevel?.toLowerCase()] || 1.55;
  const tdee = bmr * multiplier;

  // Adjust calories based on goal
  let targetCalories = tdee;
  if (user.goal?.toLowerCase().includes('loss')) {
    targetCalories *= 0.85; // 15% deficit
  } else if (user.goal?.toLowerCase().includes('gain')) {
    targetCalories *= 1.1; // 10% surplus
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    macroTargets: {
      protein: Math.round(user.weight * 1.2), // 1.2g per kg for elderly
      carbs: Math.round((targetCalories * 0.45) / 4), // 45% of calories
      fats: Math.round((targetCalories * 0.30) / 9), // 30% of calories
      fiber: 25 // Standard recommendation for elderly
    },
    mealDistribution: {
      breakfast: Math.round(targetCalories * 0.25),
      lunch: Math.round(targetCalories * 0.30),
      snacks: Math.round(targetCalories * 0.15),
      dinner: Math.round(targetCalories * 0.30)
    }
  };
}