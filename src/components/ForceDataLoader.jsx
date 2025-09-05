import React, { useEffect } from "react";

const ForceDataLoader = ({ onDataLoaded }) => {
  useEffect(() => {
    const loadSupabaseData = async () => {
      console.log("🚀 Force loading Supabase schedule data...");
      console.log("📋 onDataLoaded callback available:", !!onDataLoaded);

      // Complete actual schedule data from Supabase
      const scheduleData = {
        _staff_members: [
          {
            id: "01934d2c-8a7b-7d34-88b6-efbc1589baef",
            name: "料理長",
            color: "position-server",
            status: "社員",
            position: "Head Chef",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-738f-8717-d27e2345b63e",
            name: "井関",
            color: "position-server",
            status: "社員",
            position: "Sous Chef",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-7cfb-8e11-c2b2373ce903",
            name: "与儀",
            color: "position-server",
            status: "社員",
            position: "Choushoku",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-7ee1-82d1-94e2cc524843",
            name: "田辺",
            color: "position-server",
            status: "社員",
            position: "Shashimi",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-784e-8e78-af02ddb8c4a9",
            name: "古藤",
            color: "position-server",
            status: "社員",
            position: "Nikata",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-71b5-82bd-71fb67ea5915",
            name: "小池",
            color: "position-server",
            status: "社員",
            position: "Shasimi",
            endPeriod: null,
            startPeriod: { day: 2, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-701b-8422-b928bbdc20c",
            name: "岸",
            color: "position-server",
            status: "社員",
            position: "Zensai",
            endPeriod: null,
            startPeriod: { day: 3, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-780a-8933-895ff3468d0a",
            name: "カマル",
            color: "position-server",
            status: "社員",
            position: "Choushoku",
            endPeriod: null,
            startPeriod: { day: 1, year: 2024, month: 11 },
          },
          {
            id: "01934d2c-8a7b-76ca-8100-a1183e709ad7",
            name: "金子",
            color: "position-server",
            status: "派遣",
            position: "Prep",
            endPeriod: { day: 6, year: 2025, month: 4 },
            startPeriod: { day: 1, year: 2025, month: 1 },
          },
          {
            id: "01934d2c-8a7b-7fe7-8135-783adf94f4cb",
            name: "遠藤",
            color: "position-server",
            status: "派遣",
            position: "Prep",
            endPeriod: { day: 6, year: 2025, month: 4 },
            startPeriod: { day: 29, year: 2025, month: 1 },
          },
          {
            id: "01934d2c-8a7b-7898-812b-883de12aaccf",
            name: "中田",
            color: "position-server",
            status: "パート",
            position: "Cook",
            endPeriod: null,
            startPeriod: { day: 1, year: 2021, month: 1 },
          },
          {
            id: "01934d2c-8a7b-7fbf-8c01-03235b319e0e",
            name: "高野",
            color: "position-server",
            status: "社員",
            position: "Prep",
            endPeriod: null,
            startPeriod: { day: 1, year: 2025, month: 4 },
          },
          {
            id: "01934d2c-8a7b-7acb-8fe7-23b49421a4bb",
            name: "大城",
            color: "position-server",
            status: "派遣",
            position: "Prep",
            endPeriod: { day: 8, year: 2025, month: 6 },
            startPeriod: { day: 1, year: 2025, month: 4 },
          },
        ],
        "01934d2c-8a7b-701b-8422-b928bbdc20c": {
          "2025-05-23": "★",
          "2025-05-27": "×",
          "2025-05-30": "★",
          "2025-06-04": "×",
          "2025-06-08": "△",
          "2025-06-10": "×",
          "2025-06-15": "×",
          "2025-06-17": "×",
          "2025-06-18": "×",
          "2025-06-19": "△",
        },
        "01934d2c-8a7b-71b5-82bd-71fb67ea5915": {
          "2025-05-21": "△",
          "2025-05-25": "×",
          "2025-05-30": "△",
          "2025-06-02": "×",
          "2025-06-04": "△",
          "2025-06-07": "×",
          "2025-06-10": "△",
          "2025-06-12": "×",
          "2025-06-16": "△",
          "2025-06-17": "×",
          "2025-06-18": "×",
          "2025-06-19": "△",
        },
        "01934d2c-8a7b-738f-8717-d27e2345b63e": {
          "2025-05-23": "×",
          "2025-05-26": "△",
          "2025-05-31": "×",
          "2025-06-03": "△",
          "2025-06-05": "×",
          "2025-06-09": "×",
          "2025-06-13": "×",
          "2025-06-16": "△",
          "2025-06-17": "×",
          "2025-06-18": "×",
          "2025-06-19": "△",
        },
        "01934d2c-8a7b-7d34-88b6-efbc1589baef": {
          "2025-05-21": "×",
          "2025-05-25": "△",
          "2025-05-28": "△",
          "2025-05-30": "×",
          "2025-06-01": "△",
          "2025-06-04": "×",
          "2025-06-08": "△",
          "2025-06-12": "×",
          "2025-06-15": "△",
          "2025-06-17": "×",
          "2025-06-18": "×",
          "2025-06-19": "△",
        },
      };

      // Call the data loaded callback with proper Supabase format
      if (onDataLoaded) {
        onDataLoaded({
          id: "502c037b-9be1-4018-bc92-6970748df9e2",
          schedule_data: scheduleData,
          created_at: "2025-08-28T02:25:03.568Z",
          updated_at: "2025-08-28T02:25:03.568Z",
        });
      }

      console.log("✅ Force data load completed!");
    };

    loadSupabaseData();
  }, [onDataLoaded]);

  return null; // This component doesn't render anything
};

export default ForceDataLoader;
