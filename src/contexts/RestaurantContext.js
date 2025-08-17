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
        // Create default restaurant
        const defaultRestaurant = {
          id: crypto.randomUUID(),
          name: "My Restaurant",
          address: "",
          phone: "",
          settings: {},
          isLocalOnly: true, // All operations are local-only
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

      // Use fallback restaurant on error
      const fallbackRestaurant = {
        id: crypto.randomUUID(),
        name: "My Restaurant",
        address: "",
        phone: "",
        settings: {},
        isLocalOnly: true,
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
