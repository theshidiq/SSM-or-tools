import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const RestaurantContext = createContext(null);

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};

export const RestaurantProvider = ({ children }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize default restaurant or get from user context
  const initializeRestaurant = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we have a default restaurant
      let savedRestaurantId = localStorage.getItem('currentRestaurantId');
      
      if (savedRestaurantId) {
        // Validate the saved restaurant exists
        const { data: existingRestaurant, error: fetchError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', savedRestaurantId)
          .single();

        if (!fetchError && existingRestaurant) {
          setRestaurant(existingRestaurant);
          setIsLoading(false);
          return;
        } else {
          // Clear invalid restaurant ID
          localStorage.removeItem('currentRestaurantId');
          savedRestaurantId = null;
        }
      }

      // Try to get any existing restaurant
      const { data: restaurants, error: listError } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1);

      if (listError) {
        // If restaurants table doesn't exist or isn't accessible, create a default
        console.warn('Restaurants table not accessible, creating default restaurant');
        const defaultRestaurant = {
          id: 'default-restaurant-id',
          name: 'Default Restaurant',
          settings: {},
        };
        setRestaurant(defaultRestaurant);
        localStorage.setItem('currentRestaurantId', defaultRestaurant.id);
      } else if (restaurants && restaurants.length > 0) {
        // Use the first available restaurant
        const firstRestaurant = restaurants[0];
        setRestaurant(firstRestaurant);
        localStorage.setItem('currentRestaurantId', firstRestaurant.id);
      } else {
        // No restaurants exist, create a default one
        try {
          const { data: newRestaurant, error: createError } = await supabase
            .from('restaurants')
            .insert({
              name: 'My Restaurant',
              address: '',
              phone: '',
              settings: {}
            })
            .select()
            .single();

          if (createError) throw createError;

          setRestaurant(newRestaurant);
          localStorage.setItem('currentRestaurantId', newRestaurant.id);
        } catch (createError) {
          console.warn('Could not create restaurant in database, using fallback');
          // Use fallback restaurant
          const fallbackRestaurant = {
            id: 'fallback-restaurant-id',
            name: 'My Restaurant',
            settings: {},
          };
          setRestaurant(fallbackRestaurant);
          localStorage.setItem('currentRestaurantId', fallbackRestaurant.id);
        }
      }

    } catch (err) {
      console.error('Failed to initialize restaurant:', err);
      setError(err.message);
      
      // Use fallback restaurant on error
      const fallbackRestaurant = {
        id: 'error-fallback-restaurant-id',
        name: 'Fallback Restaurant',
        settings: {},
      };
      setRestaurant(fallbackRestaurant);
      localStorage.setItem('currentRestaurantId', fallbackRestaurant.id);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to different restaurant
  const switchRestaurant = async (restaurantId) => {
    try {
      setIsLoading(true);
      const { data: newRestaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error) throw error;

      setRestaurant(newRestaurant);
      localStorage.setItem('currentRestaurantId', restaurantId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeRestaurant();
  }, []);

  const value = {
    restaurant,
    isLoading,
    error,
    switchRestaurant,
    refreshRestaurant: initializeRestaurant,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};