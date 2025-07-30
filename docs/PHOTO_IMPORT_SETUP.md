# Photo Import Feature Setup Guide

The photo import feature allows users to take photos of handwritten shift schedules and automatically extract the schedule data using AI-powered OCR.

## Prerequisites

### Google Vision API Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one

2. **Enable the Vision API**
   - In the Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Cloud Vision API"
   - Click on it and press "Enable"

3. **Create API Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key
   - (Optional) Restrict the API key to only the Vision API for security

4. **Set Environment Variable**
   - Add your API key to `.env` file:
   ```bash
   REACT_APP_GOOGLE_VISION_API_KEY=your_actual_api_key_here
   ```

### Alternative OCR Services

If you prefer not to use Google Vision API, you can modify the `ImageProcessor.js` to use alternative services:

- **Azure Computer Vision API**
- **AWS Textract**
- **Tesseract.js** (client-side, no API key required)

## Features

### Image Capture
- **Camera capture**: Take photos directly from device camera
- **File upload**: Upload existing photos from device storage
- **Image preprocessing**: Automatic contrast enhancement for better OCR results

### AI-Powered Analysis
- **Table detection**: Automatically identifies table structure and cell boundaries
- **Text recognition**: Extracts staff names and dates with Japanese language support
- **Symbol recognition**: Recognizes shift symbols (△, ○, ▽, ×) and converts them to schedule data
- **Confidence scoring**: Provides confidence levels for detected elements

### Data Processing
- **Smart mapping**: Maps detected staff names to existing staff members
- **Conflict resolution**: Handles duplicate or similar names intelligently
- **Data validation**: Validates extracted data against expected date ranges
- **Merge options**: Allows merging imported data with existing schedules

### User Interface
- **Interactive preview**: Review and edit detected data before importing
- **Error handling**: Clear error messages and fallback options
- **Mobile-optimized**: Touch-friendly interface for mobile devices
- **Progress feedback**: Real-time processing status and progress indicators

## Usage Instructions

1. **Take/Upload Photo**
   - Click the camera icon in the navigation toolbar
   - Choose "Take Photo" to use camera or "Upload Image" for existing files
   - Ensure the entire schedule table is visible and well-lit

2. **Review Results**
   - AI will analyze the image and extract schedule data
   - Review detected staff names, dates, and shift assignments
   - Edit any incorrect detections in the confirmation interface

3. **Import Data**
   - Confirm the imported data to merge it with your existing schedule
   - New staff members will be created automatically
   - Existing staff schedules will be updated with new shift data

## Tips for Best Results

### Photo Quality
- **Good lighting**: Take photos in bright, even lighting
- **Stable camera**: Keep the camera steady and parallel to the schedule
- **Full coverage**: Ensure the entire table is visible in the frame
- **Clear text**: Make sure handwriting is legible and symbols are distinct

### Table Format
- **Clear structure**: Tables with distinct rows and columns work best
- **Consistent symbols**: Use standard shift symbols (△, ○, ▽, ×)
- **Japanese names**: Japanese staff names are fully supported
- **Date formats**: Supports various date formats (1/2, 1月2日, etc.)

### Troubleshooting
- **Low confidence warnings**: Edit detected data manually if confidence is low
- **Missing data**: Check if image quality is sufficient or try different lighting
- **Wrong symbols**: Manually correct shift assignments in the confirmation screen
- **API errors**: Verify your Google Vision API key is correct and has sufficient quota

## Security Considerations

- **API Key Protection**: Never commit your actual API key to version control
- **Image Privacy**: Images are processed by Google's servers (consider privacy implications)
- **Data Backup**: Always backup your existing schedule before importing new data
- **Rate Limits**: Be aware of Google Vision API rate limits and quotas

## Cost Considerations

Google Vision API pricing (as of 2024):
- **Text Detection**: $1.50 per 1,000 images for first 1,000 images/month
- **Free Tier**: 1,000 images per month at no charge
- **Volume Discounts**: Available for higher usage

For most restaurant shift scheduling needs, the free tier should be sufficient.

## Fallback Options

If the photo import feature is not working:

1. **Manual Entry**: Continue using the existing manual schedule entry
2. **CSV Import**: Export from other systems and import via CSV
3. **Alternative OCR**: Switch to Tesseract.js for offline processing
4. **API Alternatives**: Use Azure Computer Vision or AWS Textract

## Support

For issues with the photo import feature:

1. Check the browser console for error messages
2. Verify your API key is correctly configured
3. Test with high-quality sample images first
4. Ensure your internet connection is stable during processing

The photo import feature is designed to be optional - the app will continue to work fully without Google Vision API configuration.