import { useState, useEffect, useMemo } from 'react';

/**
 * Hook to fetch and manage Japanese national holidays from holidays-jp.github.io API.
 * Returns holidays within the specified date range.
 *
 * @param {Date|null} startDate - Start of date range
 * @param {Date|null} endDate - End of date range
 * @returns {{ holidays: Object, isLoading: boolean, error: string|null }}
 */
export const useJapaneseHolidays = (startDate, endDate) => {
  const [allHolidays, setAllHolidays] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all holidays once on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          'https://holidays-jp.github.io/api/v1/date.json',
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[HOLIDAYS] Fetched ${Object.keys(data).length} Japanese holidays from API`);
        setAllHolidays(data);
      } catch (err) {
        console.error('[HOLIDAYS] Failed to fetch Japanese holidays:', err);
        setError(err.message);
        // Return empty object on error - system continues to work
        setAllHolidays({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolidays();
  }, []);

  // Filter holidays to only those within the date range
  const holidays = useMemo(() => {
    if (!startDate || !endDate || Object.keys(allHolidays).length === 0) {
      return {};
    }

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const filtered = {};
    for (const [date, name] of Object.entries(allHolidays)) {
      if (date >= startStr && date <= endStr) {
        filtered[date] = name;
      }
    }

    console.log(`[HOLIDAYS] Filtered ${Object.keys(filtered).length} holidays in range ${startStr} to ${endStr}`);
    return filtered;
  }, [allHolidays, startDate, endDate]);

  return { holidays, allHolidays, isLoading, error };
};

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default useJapaneseHolidays;
