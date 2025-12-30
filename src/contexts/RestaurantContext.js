import React, { createContext, useContext, useState, useEffect } from "react";

const RestaurantContext = createContext(null);

// Get restaurant ID from environment variable or use default
const DEFAULT_RESTAURANT_ID = process.env.REACT_APP_RESTAURANT_ID || "4a4e4447-3ddc-4790-b2f9-b892722503b3";
const DEFAULT_RESTAURANT_NAME = "My Restaurant";

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurant must be used within a RestaurantProvider");
  }
  return context;
};

export const RestaurantProvider = ({ children }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize restaurant from localStorage
  const initializeRestaurant = () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we have saved restaurant info
      const savedRestaurantData = localStorage.getItem("restaurant-info");

      if (savedRestaurantData) {
        const restaurantInfo = JSON.parse(savedRestaurantData);
        // Check if saved restaurant ID matches the env var - if not, update it
        if (restaurantInfo.id !== DEFAULT_RESTAURANT_ID) {
          console.log(`🔄 [RestaurantContext] Updating restaurant ID from ${restaurantInfo.id} to ${DEFAULT_RESTAURANT_ID}`);
          restaurantInfo.id = DEFAULT_RESTAURANT_ID;
          restaurantInfo.name = DEFAULT_RESTAURANT_NAME;
          localStorage.setItem("restaurant-info", JSON.stringify(restaurantInfo));
        }
        setRestaurant(restaurantInfo);
      } else {
        // Use the restaurant ID from environment variable
        const defaultRestaurant = {
          id: DEFAULT_RESTAURANT_ID,
          name: DEFAULT_RESTAURANT_NAME,
          address: "",
          phone: "",
          settings: {},
          isLocalOnly: false, // Already synced to database
        };

        setRestaurant(defaultRestaurant);
        localStorage.setItem(
          "restaurant-info",
          JSON.stringify(defaultRestaurant),
        );
      }
    } catch (err) {
      console.error("Failed to initialize restaurant:", err);
      setError(err.message);

      // Use fallback restaurant on error (use the env var restaurant ID)
      const fallbackRestaurant = {
        id: DEFAULT_RESTAURANT_ID,
        name: DEFAULT_RESTAURANT_NAME,
        address: "",
        phone: "",
        settings: {},
        isLocalOnly: false,
      };
      setRestaurant(fallbackRestaurant);
      localStorage.setItem(
        "restaurant-info",
        JSON.stringify(fallbackRestaurant),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Update restaurant info
  const updateRestaurant = (updates) => {
    try {
      const updatedRestaurant = { ...restaurant, ...updates };
      setRestaurant(updatedRestaurant);
      localStorage.setItem(
        "restaurant-info",
        JSON.stringify(updatedRestaurant),
      );
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  useEffect(() => {
    initializeRestaurant();
  }, []);

  const value = {
    restaurant,
    isLoading,
    error,
    updateRestaurant,
    refreshRestaurant: initializeRestaurant,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};
