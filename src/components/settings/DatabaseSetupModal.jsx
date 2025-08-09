import React, { useState, useEffect, useCallback } from "react";
import { X, Database, CheckCircle2, AlertCircle, Clock, Loader2, RefreshCcw, AlertTriangle, Copy, ExternalLink, Zap, Shield, Settings } from "lucide-react";
import AutomatedDatabaseSetupService from "../../services/AutomatedDatabaseSetupService";
import DatabaseSetupService from "../../services/DatabaseSetupService";

const DatabaseSetupModal = ({ isOpen, onClose, onComplete }) => {
  const [automatedService] = useState(() => new AutomatedDatabaseSetupService());
  const [fallbackService] = useState(() => new DatabaseSetupService());
  const [setupMode, setSetupMode] = useState('automated'); // 'automated', 'manual'
  const [setupState, setSetupState] = useState('idle'); // 'idle', 'running', 'completed', 'failed'
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [setupSteps, setSetupSteps] = useState([]);
  const [errors, setErrors] = useState([]);
  const [setupResult, setSetupResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [schemaText, setSchemaText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [automationFailed, setAutomationFailed] = useState(false);
  
  // Initialize setup steps
  useEffect(() => {
    if (isOpen) {
      const service = setupMode === 'automated' ? automatedService : fallbackService;
      const steps = setupMode === 'automated' ? 
        service.getSetupChunks() : 
        service.getSetupSteps();
      
      setSetupSteps(steps);
      setTotalSteps(steps.length);
      setSetupState('idle');
      setProgress(0);
      setErrors([]);
      setSetupResult(null);
      setShowDetails(false);
      setShowSchema(false);
      setAutomationFailed(false);
    }
  }, [isOpen, setupMode, automatedService, fallbackService]);

  // Progress callback
  const handleProgress = useCallback((progressInfo) => {
    setProgress(progressInfo.percentage);
    setCurrentStep(progressInfo.message);
    
    const currentIndex = setupMode === 'automated' ? 
      progressInfo.currentChunk : 
      progressInfo.currentStep;
    
    setStepIndex(currentIndex);
    
    // Update step states
    setSetupSteps(prevSteps => 
      prevSteps.map((step, index) => ({
        ...step,
        isCompleted: index < currentIndex,
        isCurrent: index === currentIndex,
        isPending: index > currentIndex,
      }))
    );
  }, [setupMode]);

  // Error callback
  const handleError = useCallback((error, step) => {
    const errorInfo = {
      step: step.name,
      message: error.message,
      critical: step.critical,
      timestamp: new Date().toLocaleString(),
    };
    
    setErrors(prevErrors => [...prevErrors, errorInfo]);
    
    // If automated setup fails critically, prepare for fallback
    if (setupMode === 'automated' && step.critical) {
      setAutomationFailed(true);
    }
  }, [setupMode]);

  // Completion callback
  const handleComplete = useCallback((result) => {
    setSetupResult(result);
    setSetupState(result.success ? 'completed' : 'failed');
    
    if (result.success) {
      setProgress(100);
      setCurrentStep(setupMode === 'automated' ? 
        'Automated setup completed successfully!' : 
        'Setup completed successfully!');
      
      // Mark all steps as completed
      setSetupSteps(prevSteps => 
        prevSteps.map(step => ({ ...step, isCompleted: true, isCurrent: false, isPending: false }))
      );
      
      // Notify parent component
      if (onComplete) {
        onComplete(result);
      }
    } else {
      // Handle failure based on setup mode
      if (setupMode === 'automated' && result.fallbackRequired) {
        setCurrentStep('Automated setup failed - manual setup required');
        setAutomationFailed(true);
        
        // Generate schema for manual setup
        const schema = fallbackService.getGeneratedSchema();
        if (schema) {
          setSchemaText(schema);
        }
      } else {
        setCurrentStep(`Setup failed: ${result.error}`);
        
        // For manual mode, check if we need to show schema
        if (setupMode === 'manual') {
          const progressInfo = fallbackService.getProgress();
          if (progressInfo.generatedSchema && progressInfo.missingTables?.length > 0) {
            setSchemaText(progressInfo.generatedSchema);
            setShowSchema(true);
          }
        }
      }
    }
  }, [onComplete, setupMode, fallbackService]);

  // Execute database setup
  const executeSetup = async (mode = setupMode) => {
    try {
      setSetupState('running');
      setProgress(0);
      setErrors([]);
      setCurrentStep(mode === 'automated' ? 
        'Starting automated database setup...' : 
        'Initializing database setup...');
      
      const service = mode === 'automated' ? automatedService : fallbackService;
      
      await service.executeSetup(
        handleProgress,
        handleError,
        handleComplete
      );
      
    } catch (error) {
      console.error('Setup execution failed:', error);
      setSetupState('failed');
      setCurrentStep(`Setup failed: ${error.message}`);
      setSetupResult({ success: false, error: error.message });
    }
  };

  // Reset and try again
  const resetSetup = () => {
    setSetupState('idle');
    setProgress(0);
    setErrors([]);
    setSetupResult(null);
    setCurrentStep('');
    setStepIndex(0);
    setShowSchema(false);
    setSchemaText('');
    setAutomationFailed(false);
    
    const service = setupMode === 'automated' ? automatedService : fallbackService;
    const steps = setupMode === 'automated' ? 
      service.getSetupChunks() : 
      service.getSetupSteps();
    setSetupSteps(steps);
  };
  
  // Switch to manual setup
  const switchToManualSetup = () => {
    setSetupMode('manual');
    setSetupState('idle');
    setProgress(0);
    setErrors([]);
    setSetupResult(null);
    setCurrentStep('');
    setStepIndex(0);
    setShowSchema(true);
    setAutomationFailed(false);
    
    // Generate and display schema immediately
    const schema = fallbackService.getGeneratedSchema();
    if (schema) {
      setSchemaText(schema);
    }
    
    const steps = fallbackService.getSetupSteps();
    setSetupSteps(steps);
  };
  
  // Switch back to automated setup
  const switchToAutomatedSetup = () => {
    setSetupMode('automated');
    setSetupState('idle');
    setProgress(0);
    setErrors([]);
    setSetupResult(null);
    setCurrentStep('');
    setStepIndex(0);
    setShowSchema(false);
    setSchemaText('');
    setAutomationFailed(false);
    
    const steps = automatedService.getSetupChunks();
    setSetupSteps(steps);
  };

  // Copy schema to clipboard
  const copySchemaToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(schemaText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy schema:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = schemaText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Close modal
  const handleClose = () => {
    if (setupState === 'running') {
      if (window.confirm('Database setup is in progress. Are you sure you want to cancel?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Get step icon
  const getStepIcon = (step) => {
    if (step.isCompleted) {
      return <CheckCircle2 size={16} className="text-green-500" />;
    } else if (step.isCurrent && setupState === 'running') {
      return <Loader2 size={16} className="text-blue-500 animate-spin" />;
    } else if (step.isPending) {
      return <Clock size={16} className="text-gray-400" />;
    } else if (setupState === 'failed' && step.isCurrent) {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    return <Clock size={16} className="text-gray-400" />;
  };

  // Get step status color
  const getStepStatusColor = (step) => {
    if (step.isCompleted) return 'text-green-600';
    if (step.isCurrent && setupState === 'running') return 'text-blue-600';
    if (setupState === 'failed' && step.isCurrent) return 'text-red-600';
    return 'text-gray-500';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Database className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Database Setup</h2>
              <p className="text-gray-600 text-sm">
                {setupMode === 'automated' ? 
                  'Fully automated - no manual steps required' : 
                  'Manual setup with SQL copy-paste'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={setupState === 'running'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Setup Steps Sidebar */}
          <div className="w-80 border-r border-gray-200 bg-gray-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Setup Progress</h3>
                <div className="flex items-center gap-2">
                  {setupMode === 'automated' ? (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Zap size={12} />
                      Auto
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Settings size={12} />
                      Manual
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {setupSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      step.isCurrent ? 'bg-blue-100 border border-blue-200' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getStepIcon(step)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${getStepStatusColor(step)}`}>
                        {index + 1}. {step.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {step.description}
                      </div>
                      {step.critical && (
                        <div className="text-xs text-orange-600 mt-1 font-medium">
                          Critical Step
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            {/* Status Section */}
            <div className="mb-6">
              {setupState === 'idle' && setupMode === 'automated' && !automationFailed && (
                <div className="text-center py-8">
                  <div className="relative">
                    <Database size={48} className="mx-auto text-blue-500 mb-4" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Zap size={12} className="text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Automated Database Setup</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    One-click solution! All tables, functions, and sample data will be created automatically. 
                    No manual SQL copy-pasting required.
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Shield size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium mb-2">Fully Automated Features:</p>
                        <ul className="space-y-1 text-green-700">
                          <li>• Direct SQL execution through Supabase</li>
                          <li>• Smart table detection (skips existing tables)</li>
                          <li>• Automatic retry with error recovery</li>
                          <li>• Real-time progress tracking</li>
                          <li>• Fallback to manual setup if needed</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => executeSetup('automated')}
                      className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 mx-auto"
                    >
                      <Zap size={16} />
                      Start Automated Setup
                    </button>
                    
                    <div className="text-center">
                      <button
                        onClick={switchToManualSetup}
                        className="text-sm text-gray-600 hover:text-gray-700 underline"
                      >
                        Use Manual Setup Instead
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {setupState === 'idle' && (setupMode === 'manual' || automationFailed) && (
                <div className="text-center py-8">
                  <Database size={48} className="mx-auto text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Manual Database Setup</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {automationFailed ? 
                      'Automated setup failed. Please use manual setup with SQL copy-paste.' :
                      'Traditional setup method using SQL copy-paste in Supabase dashboard.'}
                  </p>
                  
                  {automationFailed && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-orange-800">
                          <p className="font-medium mb-2">Automated Setup Failed</p>
                          <p className="mb-2">
                            The automated setup couldn't complete due to database permissions or connection issues. 
                            Manual setup is now required.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-2">Manual Setup Requirements:</p>
                        <ul className="space-y-1 text-yellow-700">
                          <li>• Admin access to your Supabase project</li>
                          <li>• Access to the SQL Editor in Supabase dashboard</li>
                          <li>• Copy-paste the provided SQL schema</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => executeSetup('manual')}
                      className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Start Manual Setup
                    </button>
                    
                    {!automationFailed && (
                      <div className="text-center">
                        <button
                          onClick={switchToAutomatedSetup}
                          className="text-sm text-green-600 hover:text-green-700 underline"
                        >
                          Try Automated Setup Instead
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {setupState === 'running' && (
                <div className="text-center py-8">
                  <div className="relative">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-4 animate-spin" />
                    {setupMode === 'automated' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Zap size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {setupMode === 'automated' ? 'Automated Setup Running' : 'Setting up Database'}
                  </h3>
                  <p className="text-gray-600 mb-4">{currentStep}</p>
                  
                  {/* Progress Bar */}
                  <div className="max-w-md mx-auto">
                    <div className="bg-gray-200 rounded-full h-3 mb-2">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Step {stepIndex + 1} of {totalSteps}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>

                  <div className="mt-6 text-sm text-gray-500">
                    {setupMode === 'automated' ? 
                      'Executing SQL directly through Supabase...' :
                      'Please wait while the database is being configured...'}
                  </div>
                  
                  {setupMode === 'automated' && (
                    <div className="mt-4 text-xs text-green-600">
                      No manual intervention required
                    </div>
                  )}
                </div>
              )}

              {setupState === 'completed' && (
                <div className="text-center py-8">
                  <div className="relative">
                    <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
                    {setupMode === 'automated' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Zap size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {setupMode === 'automated' ? 'Automated Setup Complete!' : 'Database Setup Complete!'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {setupMode === 'automated' ? 
                      'All database tables, functions, and configurations were created automatically. No manual steps were required!' :
                      'All database tables have been created successfully. You can now use all features of the application.'}
                  </p>
                  
                  {setupResult && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <div className="text-sm text-green-800">
                        <p className="font-medium">
                          ✅ {setupMode === 'automated' ? setupResult.chunksCompleted : setupResult.stepsCompleted} {setupMode === 'automated' ? 'chunks' : 'steps'} completed successfully
                        </p>
                        {setupResult.tablesCreated && setupResult.tablesCreated.length > 0 && (
                          <p className="mt-1">🗂️ Created {setupResult.tablesCreated.length} new tables</p>
                        )}
                        {setupResult.tablesExisted && setupResult.tablesExisted.length > 0 && (
                          <p className="mt-1">⏭️ Skipped {setupResult.tablesExisted.length} existing tables</p>
                        )}
                        {errors.length > 0 && (
                          <p className="mt-1">⚠️ {errors.length} non-critical warnings (see details below)</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={onClose}
                      className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      Continue to Settings
                    </button>
                    
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        {showDetails ? 'Hide Details' : 'Show Setup Details'}
                      </button>
                      {schemaText && (
                        <button
                          onClick={() => setShowSchema(!showSchema)}
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          {showSchema ? 'Hide Schema' : 'View SQL Schema'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {setupState === 'failed' && (
                <div className="text-center py-8">
                  <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {setupMode === 'automated' && setupResult?.fallbackRequired ? 
                      'Automated Setup Failed' : 
                      'Database Setup Failed'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {setupMode === 'automated' && setupResult?.fallbackRequired ? 
                      'The automated setup encountered issues. Please use manual setup instead.' :
                      'There was an error setting up the database. Please check the details below and try again.'}
                  </p>
                  
                  {setupResult?.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                      <p className="font-medium text-red-800">Error Details:</p>
                      <p className="text-sm text-red-700 mt-1">{setupResult.error}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {setupMode === 'automated' && setupResult?.fallbackRequired ? (
                      <button
                        onClick={switchToManualSetup}
                        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Switch to Manual Setup
                      </button>
                    ) : (
                      <button
                        onClick={resetSetup}
                        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <RefreshCcw size={16} className="inline mr-2" />
                        Try Again
                      </button>
                    )}
                    
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        {showDetails ? 'Hide Details' : 'Show Error Details'}
                      </button>
                      {(schemaText || setupMode === 'manual') && (
                        <button
                          onClick={() => {
                            if (!schemaText) {
                              const schema = fallbackService.getGeneratedSchema();
                              setSchemaText(schema);
                            }
                            setShowSchema(!showSchema);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          {showSchema ? 'Hide Schema' : 'View SQL Schema'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Schema Section */}
            {showSchema && schemaText && (
              <div className="border-t border-gray-200 pt-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">Database Schema</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copySchemaToClipboard}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                          copySuccess 
                            ? 'text-green-700 bg-green-50 border border-green-200' 
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-blue-500'
                        }`}
                      >
                        <Copy size={16} className="mr-1.5" />
                        {copySuccess ? 'Copied!' : 'Copy Schema'}
                      </button>
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <ExternalLink size={16} className="mr-1.5" />
                        Open Supabase
                      </a>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-2">
                          {setupMode === 'automated' && automationFailed ? 
                            'Automated Setup Failed - Manual Setup Required' :
                            'Manual Database Setup Required'}
                        </p>
                        <p className="mb-2">
                          {setupMode === 'automated' && automationFailed ? 
                            'The automated setup could not complete due to database permissions. Please follow these manual steps:' :
                            'Some required database tables are missing. Please follow these steps:'}
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-yellow-700">
                          <li>Copy the SQL schema below</li>
                          <li>Open your Supabase dashboard</li>
                          <li>Navigate to the SQL Editor</li>
                          <li>Paste and run the complete schema</li>
                          <li>Return here and click "Validate Setup" to continue</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                      {schemaText}
                    </pre>
                  </div>

                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setShowSchema(false);
                        executeSetup('manual');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Validate Setup
                    </button>
                    
                    {!automationFailed && (
                      <button
                        onClick={() => {
                          setShowSchema(false);
                          switchToAutomatedSetup();
                        }}
                        className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
                      >
                        <Zap size={14} />
                        Try Automated
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Details Section */}
            {showDetails && (errors.length > 0 || setupResult) && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Setup Details</h4>
                
                {errors.length > 0 && (
                  <div className="mb-6">
                    <h5 className="font-medium text-gray-700 mb-2">
                      {setupState === 'failed' ? 'Errors' : 'Warnings'} ({errors.length})
                    </h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {errors.map((error, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            error.critical
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm">
                              <p className="font-medium">{error.step}</p>
                              <p className="mt-1">{error.message}</p>
                              <p className="text-xs opacity-75 mt-1">{error.timestamp}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {setupResult && (
                  <div className="text-sm text-gray-600">
                    <p>Setup completed at {new Date().toLocaleString()}</p>
                    <p>Total steps: {setupResult.stepsCompleted || 0}</p>
                    {setupResult.rollbackAvailable && (
                      <p className="text-orange-600 font-medium mt-2">
                        Rollback is available if needed
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseSetupModal;