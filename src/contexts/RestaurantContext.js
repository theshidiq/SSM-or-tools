import React, { createContext, useContext, useState, useEffect } from "react";

const RestaurantContext = createContext(null);

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
        setRestaurant(restaurantInfo);
      } else {
        // Use the existing synced restaurant ID from database
        // This restaurant already exists in Supabase
        const defaultRestaurant = {
          id: "e1661c71-b24f-4ee1-9e8b-7290a43c9575",
          name: "Sample Restaurant",
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

      // Use fallback restaurant on error (use the synced restaurant ID)
      const fallbackRestaurant = {
        id: "e1661c71-b24f-4ee1-9e8b-7290a43c9575",
        name: "Sample Restaurant",
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
