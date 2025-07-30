# Testing the Photo Import Feature

This guide provides testing instructions for the photo import feature.

## Test Cases

### Basic Functionality Tests

#### 1. UI Component Tests
- [ ] Photo import button appears in navigation toolbar
- [ ] Modal opens when photo import button is clicked
- [ ] Modal displays proper warning when API key is not configured
- [ ] Camera and file upload options are available
- [ ] Modal closes properly when X button is clicked

#### 2. File Upload Tests
- [ ] File input accepts image files (JPEG, PNG, etc.)
- [ ] File input rejects non-image files with proper error message
- [ ] Large files (>10MB) are rejected with appropriate error
- [ ] Image preview displays correctly after file selection
- [ ] "Analyze Schedule" button is disabled without API key

#### 3. Camera Capture Tests
- [ ] Camera permission request works properly
- [ ] Video stream displays in the camera view
- [ ] Camera captures photos successfully
- [ ] Back camera is preferred on mobile devices
- [ ] Camera stream stops properly when cancelled

### API Integration Tests

#### 4. Google Vision API Tests (Requires API Key)
- [ ] API key validation works correctly
- [ ] Invalid API key shows appropriate error message
- [ ] Network errors are handled gracefully
- [ ] Rate limit errors provide helpful messages
- [ ] Processing progress indicator updates correctly

#### 5. OCR Results Processing
- [ ] Text detection works with Japanese characters
- [ ] Shift symbols (△, ○, ▽, ×) are recognized correctly
- [ ] Table structure detection identifies rows and columns
- [ ] Staff names are extracted from table headers
- [ ] Dates are parsed in various formats (1/2, 1月2日, etc.)

### Data Processing Tests

#### 6. Schedule Parser Tests
- [ ] Detected staff names map to existing staff members
- [ ] New staff members are created for unrecognized names
- [ ] Shift assignments are correctly mapped to schedule structure
- [ ] Empty cells are handled properly
- [ ] Custom text values are preserved

#### 7. Import Confirmation Tests
- [ ] Detected data displays correctly in preview table
- [ ] Staff information (name, position, status) can be edited
- [ ] Shift values can be modified in the confirmation interface
- [ ] Warnings appear for low confidence detections
- [ ] New staff members are highlighted appropriately

### Mobile/Responsive Tests

#### 8. Mobile Device Tests
- [ ] Modal is properly sized on small screens
- [ ] Touch targets are at least 44px for accessibility
- [ ] Camera interface works on mobile browsers
- [ ] File upload works with mobile photo picker
- [ ] Scrolling works properly in confirmation interface
- [ ] Table in confirmation is horizontally scrollable

#### 9. Cross-Browser Tests
- [ ] Works in Chrome (desktop and mobile)
- [ ] Works in Safari (desktop and mobile)
- [ ] Works in Firefox
- [ ] Works in Edge
- [ ] Camera API is supported or falls back gracefully

### Error Handling Tests

#### 10. Error Scenarios
- [ ] No text detected in image shows appropriate message
- [ ] Poor quality images provide helpful feedback
- [ ] Network timeouts are handled gracefully
- [ ] API quota exceeded shows rate limit message
- [ ] Malformed images are rejected with clear errors

#### 11. Fallback Behavior
- [ ] App continues to work normally without API configuration
- [ ] Manual schedule entry remains fully functional
- [ ] Existing features are not affected by photo import addition
- [ ] Error messages provide actionable guidance

## Sample Test Images

Create test images with the following characteristics:

### Good Quality Test Images
1. **Clear handwritten schedule** - Japanese staff names, clear symbols
2. **Printed schedule** - Computer-generated table with shift symbols
3. **Mobile photo** - Schedule photographed with phone camera
4. **Well-lit schedule** - Good lighting, high contrast

### Edge Case Test Images
1. **Poor lighting** - Dark or shadowy image
2. **Blurry image** - Out of focus or motion blur
3. **Partial table** - Only part of schedule visible
4. **Mixed languages** - Japanese and English text
5. **Rotated image** - Schedule at an angle
6. **Complex background** - Schedule with distracting background

### Negative Test Images
1. **No text** - Blank or decorative image
2. **Wrong content** - Non-schedule document
3. **Multiple tables** - Confusing table structure
4. **Very small text** - Illegible handwriting

## Performance Tests

### 12. Performance Benchmarks
- [ ] Image preprocessing completes within 5 seconds
- [ ] OCR analysis completes within 15 seconds
- [ ] Schedule parsing completes within 2 seconds
- [ ] Total import process completes within 30 seconds
- [ ] UI remains responsive during processing

### 13. Resource Usage
- [ ] Camera stream doesn't cause memory leaks
- [ ] Large images are properly resized before processing
- [ ] Modal cleanup releases resources properly
- [ ] No memory leaks with repeated use

## Accessibility Tests

### 14. Accessibility Compliance
- [ ] All buttons have proper ARIA labels
- [ ] Modal can be navigated with keyboard
- [ ] Screen readers can access all content
- [ ] Focus management works correctly
- [ ] Color contrast meets WCAG guidelines

## Integration Tests

### 15. Data Integration
- [ ] Imported data integrates with existing schedules
- [ ] Staff member conflicts are handled properly
- [ ] Schedule data structure remains consistent
- [ ] Auto-save works with imported data
- [ ] Undo functionality works after import

### 16. Workflow Tests
- [ ] Complete import workflow works end-to-end
- [ ] Can import multiple schedules in sequence
- [ ] Can cancel import at any stage
- [ ] Can retry failed imports
- [ ] Can edit imported data after confirmation

## Automated Testing

Consider implementing these automated tests:

```javascript
// Example test structure
describe('Photo Import Feature', () => {
  describe('UI Components', () => {
    test('renders photo import button in toolbar', () => {
      // Test implementation
    });
    
    test('opens modal when button clicked', () => {
      // Test implementation
    });
  });
  
  describe('File Upload', () => {
    test('accepts valid image files', () => {
      // Test implementation
    });
    
    test('rejects invalid file types', () => {
      // Test implementation
    });
  });
  
  describe('OCR Processing', () => {
    test('processes sample schedule image', async () => {
      // Mock API response and test parsing
    });
  });
});
```

## Manual Testing Checklist

Use this checklist for manual testing before release:

- [ ] All automated tests pass
- [ ] Manual testing completed on primary browsers
- [ ] Mobile testing completed on iOS and Android
- [ ] API integration tested with real Google Vision API
- [ ] Error scenarios tested and handled properly
- [ ] Performance benchmarks met
- [ ] Accessibility requirements satisfied
- [ ] Documentation is accurate and complete

## Known Limitations

Document any known limitations:

1. **Image Quality**: Requires reasonably clear, well-lit images
2. **Table Structure**: Works best with clearly defined table boundaries
3. **Handwriting**: May struggle with very messy handwriting
4. **Complex Layouts**: Single table per image works best
5. **API Dependencies**: Requires internet connection and valid API key

## Future Improvements

Consider these enhancements for future versions:

1. **Offline OCR**: Add Tesseract.js for offline processing
2. **Batch Processing**: Support multiple images at once
3. **Image Enhancement**: Auto-rotation and noise reduction
4. **Template Matching**: Learn from successful imports
5. **Validation Rules**: Custom validation for imported data