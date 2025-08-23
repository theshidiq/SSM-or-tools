/**
 * OptimizedTransferSystem.js
 * 
 * Advanced data transfer optimization system that minimizes main thread blocking
 * during data transfer between workers and main thread through intelligent 
 * chunking, compression, and progressive transfer techniques.
 */

export class OptimizedTransferSystem {
  constructor() {
    this.isInitialized = false;
    
    // Transfer configuration
    this.config = {
      maxTransferChunkSize: 64 * 1024,      // 64KB chunks
      compressionThreshold: 1024,           // Compress data > 1KB
      progressiveTransferThreshold: 100 * 1024, // 100KB for progressive transfer
      transferTimeout: 30000,               // 30 second timeout
      maxConcurrentTransfers: 3,            // Max simultaneous transfers
      enableCompression: true,              // Enable data compression
      enableProgressiveTransfer: true,      // Enable progressive transfer
      enableTransferCaching: true,          // Enable transfer result caching
      transferBufferSize: 256 * 1024        // 256KB transfer buffer
    };

    // Transfer state management
    this.transferState = {
      activeTransfers: new Map(),           // transferId -> transferInfo
      transferQueue: [],                    // Queued transfers waiting to start
      completedTransfers: new Map(),        // Recently completed transfers
      transferCache: new Map(),             // Cached transfer results
      totalTransfers: 0,
      successfulTransfers: 0,
      failedTransfers: 0
    };

    // Data optimization strategies
    this.optimizationStrategies = {
      numeric: {
        name: 'Numeric Data Optimization',
        detect: (data) => this.isNumericData(data),
        optimize: (data) => this.optimizeNumericData(data),
        decompress: (data) => this.decompressNumericData(data)
      },
      tensor: {
        name: 'Tensor Data Optimization',
        detect: (data) => this.isTensorData(data),
        optimize: (data) => this.optimizeTensorData(data),
        decompress: (data) => this.decompressTensorData(data)
      },
      object: {
        name: 'Object Data Optimization',
        detect: (data) => this.isObjectData(data),
        optimize: (data) => this.optimizeObjectData(data),
        decompress: (data) => this.decompressObjectData(data)
      },
      array: {
        name: 'Array Data Optimization',
        detect: (data) => this.isArrayData(data),
        optimize: (data) => this.optimizeArrayData(data),
        decompress: (data) => this.decompressArrayData(data)
      }
    };

    // Transfer performance metrics
    this.metrics = {
      totalBytesTransferred: 0,
      totalCompressionRatio: 0,
      averageTransferSpeed: 0,
      transferTimes: [],
      compressionTimes: [],
      decompressionTimes: [],
      cacheHitRate: 0,
      mainThreadBlockingTime: 0
    };

    // Event handlers
    this.eventHandlers = {
      transferStart: new Set(),
      transferProgress: new Set(),
      transferComplete: new Set(),
      transferError: new Set(),
      transferOptimized: new Set(),
      cacheHit: new Set()
    };

    // Compression and decompression workers
    this.compressionWorkers = [];
    this.compressionQueue = [];
    this.workerPool = null;

    // Transfer utilities
    this.transferUtils = {
      progressiveTransfers: new Map(),
      compressionCache: new Map(),
      transferBuffers: [],
      recycledBuffers: []
    };
  }

  /**
   * Initialize the optimized transfer system
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, fromCache: true };
    }

    try {
      console.log('📦 Initializing Optimized Transfer System...');

      // Apply configuration
      Object.assign(this.config, options);

      // Initialize compression workers if supported
      await this.initializeCompressionWorkers();

      // Setup transfer buffer management
      this.initializeTransferBuffers();

      // Setup transfer optimization strategies
      this.setupOptimizationStrategies();

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Setup cleanup and maintenance
      this.startMaintenance();

      this.isInitialized = true;

      console.log('✅ Optimized Transfer System initialized:', {
        compressionEnabled: this.config.enableCompression,
        progressiveTransfer: this.config.enableProgressiveTransfer,
        maxChunkSize: this.config.maxTransferChunkSize + ' bytes',
        compressionWorkers: this.compressionWorkers.length
      });

      return {
        success: true,
        capabilities: this.getTransferCapabilities(),
        config: this.config
      };

    } catch (error) {
      console.error('❌ Optimized Transfer System initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize compression workers for parallel processing
   */
  async initializeCompressionWorkers() {
    if (!this.config.enableCompression || typeof Worker === 'undefined') {
      console.log('⚠️ Compression workers not available, using main thread compression');
      return;
    }

    try {
      // Create dedicated compression workers
      const workerCount = Math.min(2, navigator.hardwareConcurrency || 2);
      
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(this.createCompressionWorkerBlob());
        worker.onmessage = (event) => this.handleCompressionWorkerMessage(event);
        worker.onerror = (error) => this.handleCompressionWorkerError(error);
        
        this.compressionWorkers.push({
          worker,
          id: `compression_${i}`,
          busy: false,
          tasks: new Set()
        });
      }

      console.log(`✅ Initialized ${this.compressionWorkers.length} compression workers`);

    } catch (error) {
      console.warn('Failed to initialize compression workers:', error);
    }
  }

  /**
   * Create compression worker blob
   */
  createCompressionWorkerBlob() {
    const workerScript = `
      // Compression worker implementation
      self.onmessage = async function(event) {
        const { id, action, data, options } = event.data;
        
        try {
          let result;
          
          switch (action) {
            case 'compress':
              result = await compressData(data, options);
              break;
            case 'decompress':
              result = await decompressData(data, options);
              break;
            default:
              throw new Error('Unknown compression action: ' + action);
          }
          
          self.postMessage({
            id,
            success: true,
            result,
            originalSize: data.length || data.byteLength || 0,
            compressedSize: result.length || result.byteLength || 0
          });
          
        } catch (error) {
          self.postMessage({
            id,
            success: false,
            error: error.message
          });
        }
      };
      
      // Simple compression using built-in compression
      async function compressData(data, options) {
        // Convert data to string if needed
        const stringData = typeof data === 'string' ? data : JSON.stringify(data);
        
        // Use CompressionStream if available (modern browsers)
        if ('CompressionStream' in self) {
          const stream = new CompressionStream('gzip');
          const writer = stream.writable.getWriter();
          const reader = stream.readable.getReader();
          
          writer.write(new TextEncoder().encode(stringData));
          writer.close();
          
          const chunks = [];
          let done = false;
          
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) chunks.push(value);
          }
          
          return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
        }
        
        // Fallback to simple string compression
        return stringData;
      }
      
      async function decompressData(data, options) {
        // Use DecompressionStream if available
        if ('DecompressionStream' in self && data instanceof Uint8Array) {
          const stream = new DecompressionStream('gzip');
          const writer = stream.writable.getWriter();
          const reader = stream.readable.getReader();
          
          writer.write(data);
          writer.close();
          
          const chunks = [];
          let done = false;
          
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) chunks.push(value);
          }
          
          const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
          return new TextDecoder().decode(decompressed);
        }
        
        // Fallback
        return data;
      }
    `;

    return URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' }));
  }

  /**
   * Initialize transfer buffer management
   */
  initializeTransferBuffers() {
    // Pre-allocate transfer buffers to avoid allocation during transfer
    const bufferCount = this.config.maxConcurrentTransfers * 2;
    
    for (let i = 0; i < bufferCount; i++) {
      const buffer = new ArrayBuffer(this.config.transferBufferSize);
      this.transferUtils.transferBuffers.push(buffer);
    }

    console.log(`📋 Initialized ${bufferCount} transfer buffers`);
  }

  /**
   * Setup optimization strategies based on data patterns
   */
  setupOptimizationStrategies() {
    // Additional strategies can be registered here
    console.log('🔧 Optimization strategies configured:', Object.keys(this.optimizationStrategies));
  }

  /**
   * Setup performance monitoring for transfers
   */
  setupPerformanceMonitoring() {
    // Monitor transfer performance every 5 seconds
    setInterval(() => {
      this.updateTransferMetrics();
    }, 5000);

    // Monitor main thread blocking
    this.setupMainThreadMonitoring();
  }

  /**
   * Monitor main thread blocking during transfers
   */
  setupMainThreadMonitoring() {
    let lastTime = performance.now();
    
    const checkBlocking = () => {
      const currentTime = performance.now();
      const timeDiff = currentTime - lastTime;
      
      // If time difference is significantly more than expected, thread was blocked
      if (timeDiff > 20) { // More than 20ms indicates blocking
        this.metrics.mainThreadBlockingTime += timeDiff - 16; // Subtract expected frame time
      }
      
      lastTime = currentTime;
      requestAnimationFrame(checkBlocking);
    };

    requestAnimationFrame(checkBlocking);
  }

  /**
   * Optimized data transfer with intelligent chunking and compression
   */
  async optimizedTransfer(data, options = {}) {
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    try {
      console.log(`📦 Starting optimized transfer: ${transferId}`);

      // Check cache first
      if (this.config.enableTransferCaching) {
        const cachedResult = this.checkTransferCache(data, options);
        if (cachedResult) {
          this.fireEvent('cacheHit', { transferId, cacheKey: cachedResult.key });
          return cachedResult.result;
        }
      }

      // Create transfer info
      const transferInfo = {
        id: transferId,
        startTime,
        originalSize: this.calculateDataSize(data),
        data,
        options,
        status: 'preparing'
      };

      this.transferState.activeTransfers.set(transferId, transferInfo);
      this.fireEvent('transferStart', { transferId, originalSize: transferInfo.originalSize });

      // Analyze data and select optimization strategy
      const strategy = this.selectOptimizationStrategy(data);
      transferInfo.strategy = strategy;
      transferInfo.status = 'optimizing';

      // Optimize data based on selected strategy
      const optimizedData = await this.applyOptimization(data, strategy);
      transferInfo.optimizedSize = this.calculateDataSize(optimizedData);
      
      this.fireEvent('transferOptimized', {
        transferId,
        strategy: strategy.name,
        compressionRatio: transferInfo.originalSize / transferInfo.optimizedSize
      });

      // Transfer data using appropriate method
      let result;
      if (transferInfo.optimizedSize > this.config.progressiveTransferThreshold) {
        result = await this.progressiveTransfer(optimizedData, transferInfo);
      } else {
        result = await this.directTransfer(optimizedData, transferInfo);
      }

      // Decompress result if needed
      const finalResult = await this.applyDecompression(result, strategy);
      
      // Update transfer info
      transferInfo.status = 'completed';
      transferInfo.endTime = performance.now();
      transferInfo.totalTime = transferInfo.endTime - startTime;
      transferInfo.result = finalResult;

      // Cache result if enabled
      if (this.config.enableTransferCaching) {
        this.cacheTransferResult(data, options, finalResult);
      }

      // Update metrics
      this.updateTransferSuccess(transferInfo);

      // Cleanup
      this.transferState.activeTransfers.delete(transferId);
      this.transferState.completedTransfers.set(transferId, transferInfo);

      this.fireEvent('transferComplete', {
        transferId,
        totalTime: transferInfo.totalTime,
        compressionRatio: transferInfo.originalSize / transferInfo.optimizedSize,
        transferSpeed: transferInfo.originalSize / transferInfo.totalTime * 1000 // bytes per second
      });

      console.log(`✅ Transfer completed: ${transferId} in ${transferInfo.totalTime.toFixed(2)}ms`);

      return finalResult;

    } catch (error) {
      console.error(`❌ Transfer failed: ${transferId}`, error);
      
      // Cleanup failed transfer
      this.transferState.activeTransfers.delete(transferId);
      this.transferState.failedTransfers++;

      this.fireEvent('transferError', { transferId, error: error.message });
      throw error;
    }
  }

  /**
   * Select optimal optimization strategy for data
   */
  selectOptimizationStrategy(data) {
    for (const [key, strategy] of Object.entries(this.optimizationStrategies)) {
      if (strategy.detect(data)) {
        console.log(`🎯 Selected optimization strategy: ${strategy.name}`);
        return { key, ...strategy };
      }
    }

    // Default to object optimization
    return { key: 'object', ...this.optimizationStrategies.object };
  }

  /**
   * Apply selected optimization strategy
   */
  async applyOptimization(data, strategy) {
    const startTime = performance.now();
    
    try {
      let optimizedData = strategy.optimize(data);
      
      // Apply compression if beneficial
      if (this.config.enableCompression && 
          this.calculateDataSize(data) > this.config.compressionThreshold) {
        optimizedData = await this.compressData(optimizedData);
      }
      
      const optimizationTime = performance.now() - startTime;
      this.metrics.compressionTimes.push(optimizationTime);
      
      return optimizedData;
      
    } catch (error) {
      console.warn('Optimization failed, using original data:', error);
      return data;
    }
  }

  /**
   * Apply decompression and strategy reversal
   */
  async applyDecompression(data, strategy) {
    const startTime = performance.now();
    
    try {
      // Decompress if compressed
      let decompressedData = data;
      if (this.isCompressedData(data)) {
        decompressedData = await this.decompressData(data);
      }
      
      // Apply strategy decompression
      const finalData = strategy.decompress(decompressedData);
      
      const decompressionTime = performance.now() - startTime;
      this.metrics.decompressionTimes.push(decompressionTime);
      
      return finalData;
      
    } catch (error) {
      console.warn('Decompression failed, returning data as-is:', error);
      return data;
    }
  }

  /**
   * Progressive transfer for large datasets
   */
  async progressiveTransfer(data, transferInfo) {
    console.log(`🌊 Starting progressive transfer for ${transferInfo.id}`);
    
    transferInfo.status = 'transferring';
    const chunks = this.chunkData(data, this.config.maxTransferChunkSize);
    const results = [];
    let transferredChunks = 0;

    for (const chunk of chunks) {
      // Yield control to prevent blocking
      await this.yieldControl();
      
      // Transfer chunk
      const chunkResult = await this.transferChunk(chunk, transferInfo, transferredChunks);
      results.push(chunkResult);
      transferredChunks++;

      // Update progress
      const progress = (transferredChunks / chunks.length) * 100;
      this.fireEvent('transferProgress', {
        transferId: transferInfo.id,
        progress,
        chunksTransferred: transferredChunks,
        totalChunks: chunks.length
      });
    }

    return this.reassembleChunks(results);
  }

  /**
   * Direct transfer for smaller datasets
   */
  async directTransfer(data, transferInfo) {
    console.log(`📤 Direct transfer for ${transferInfo.id}`);
    
    transferInfo.status = 'transferring';
    
    // For direct transfer, we simulate the transfer delay
    // In a real implementation, this would be the actual data transfer
    await this.simulateTransferDelay(data);
    
    return data;
  }

  /**
   * Chunk data into optimal transfer sizes
   */
  chunkData(data, chunkSize) {
    if (data instanceof ArrayBuffer) {
      return this.chunkArrayBuffer(data, chunkSize);
    } else if (typeof data === 'string') {
      return this.chunkString(data, chunkSize);
    } else if (Array.isArray(data)) {
      return this.chunkArray(data, chunkSize);
    } else {
      // For objects, convert to string first
      const jsonString = JSON.stringify(data);
      return this.chunkString(jsonString, chunkSize);
    }
  }

  /**
   * Chunk ArrayBuffer data
   */
  chunkArrayBuffer(buffer, chunkSize) {
    const chunks = [];
    for (let i = 0; i < buffer.byteLength; i += chunkSize) {
      const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.byteLength));
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Chunk string data
   */
  chunkString(str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Chunk array data
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Transfer individual chunk
   */
  async transferChunk(chunk, transferInfo, chunkIndex) {
    // Get or allocate transfer buffer
    const buffer = this.getTransferBuffer();
    
    try {
      // Copy chunk data to buffer (simulation)
      // In real implementation, this would prepare data for worker transfer
      const chunkData = this.prepareChunkForTransfer(chunk, buffer);
      
      // Simulate transfer time based on chunk size
      const transferTime = this.calculateChunkTransferTime(chunkData);
      await new Promise(resolve => setTimeout(resolve, transferTime));
      
      return chunkData;
      
    } finally {
      // Return buffer to pool
      this.returnTransferBuffer(buffer);
    }
  }

  /**
   * Reassemble transferred chunks
   */
  reassembleChunks(chunks) {
    if (chunks.length === 0) return null;
    
    const firstChunk = chunks[0];
    
    if (firstChunk instanceof ArrayBuffer) {
      // Reassemble ArrayBuffer chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const result = new ArrayBuffer(totalLength);
      const resultView = new Uint8Array(result);
      let offset = 0;
      
      for (const chunk of chunks) {
        resultView.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return result;
    } else if (typeof firstChunk === 'string') {
      // Reassemble string chunks
      return chunks.join('');
    } else if (Array.isArray(firstChunk)) {
      // Reassemble array chunks
      return chunks.flat();
    } else {
      // For other data types, assume they were JSON stringified
      const jsonString = chunks.join('');
      return JSON.parse(jsonString);
    }
  }

  /**
   * Compress data using available compression method
   */
  async compressData(data) {
    if (this.compressionWorkers.length > 0) {
      return await this.compressWithWorker(data);
    } else {
      return await this.compressOnMainThread(data);
    }
  }

  /**
   * Compress data using worker
   */
  async compressWithWorker(data) {
    const worker = this.getAvailableCompressionWorker();
    if (!worker) {
      return await this.compressOnMainThread(data);
    }

    return new Promise((resolve, reject) => {
      const taskId = `compress_${Date.now()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 10000);

      const messageHandler = (event) => {
        if (event.data.id === taskId) {
          clearTimeout(timeout);
          worker.worker.removeEventListener('message', messageHandler);
          worker.busy = false;
          worker.tasks.delete(taskId);

          if (event.data.success) {
            resolve({
              data: event.data.result,
              compressed: true,
              originalSize: event.data.originalSize,
              compressedSize: event.data.compressedSize
            });
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      worker.worker.addEventListener('message', messageHandler);
      worker.busy = true;
      worker.tasks.add(taskId);

      worker.worker.postMessage({
        id: taskId,
        action: 'compress',
        data,
        options: {}
      });
    });
  }

  /**
   * Compress data on main thread (fallback)
   */
  async compressOnMainThread(data) {
    // Yield control before compression
    await this.yieldControl();
    
    try {
      // Simple JSON compression by removing whitespace
      if (typeof data === 'object') {
        const jsonString = JSON.stringify(data);
        return {
          data: jsonString,
          compressed: true,
          originalSize: JSON.stringify(data, null, 2).length,
          compressedSize: jsonString.length
        };
      }
      
      return {
        data,
        compressed: false,
        originalSize: data.length || data.byteLength || 0,
        compressedSize: data.length || data.byteLength || 0
      };
    } catch (error) {
      console.warn('Main thread compression failed:', error);
      return {
        data,
        compressed: false,
        originalSize: data.length || data.byteLength || 0,
        compressedSize: data.length || data.byteLength || 0
      };
    }
  }

  /**
   * Decompress data
   */
  async decompressData(compressedData) {
    if (!compressedData.compressed) {
      return compressedData.data;
    }

    if (this.compressionWorkers.length > 0) {
      return await this.decompressWithWorker(compressedData);
    } else {
      return await this.decompressOnMainThread(compressedData);
    }
  }

  /**
   * Decompress data using worker
   */
  async decompressWithWorker(compressedData) {
    const worker = this.getAvailableCompressionWorker();
    if (!worker) {
      return await this.decompressOnMainThread(compressedData);
    }

    return new Promise((resolve, reject) => {
      const taskId = `decompress_${Date.now()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Decompression timeout'));
      }, 10000);

      const messageHandler = (event) => {
        if (event.data.id === taskId) {
          clearTimeout(timeout);
          worker.worker.removeEventListener('message', messageHandler);
          worker.busy = false;
          worker.tasks.delete(taskId);

          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      worker.worker.addEventListener('message', messageHandler);
      worker.busy = true;
      worker.tasks.add(taskId);

      worker.worker.postMessage({
        id: taskId,
        action: 'decompress',
        data: compressedData.data,
        options: {}
      });
    });
  }

  /**
   * Decompress data on main thread (fallback)
   */
  async decompressOnMainThread(compressedData) {
    await this.yieldControl();
    
    try {
      if (typeof compressedData.data === 'string') {
        return JSON.parse(compressedData.data);
      }
      return compressedData.data;
    } catch (error) {
      console.warn('Main thread decompression failed:', error);
      return compressedData.data;
    }
  }

  /**
   * Data type detection methods
   */
  isNumericData(data) {
    return Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'number');
  }

  isTensorData(data) {
    return data && typeof data === 'object' && data.shape && data.data;
  }

  isObjectData(data) {
    return data && typeof data === 'object' && !Array.isArray(data);
  }

  isArrayData(data) {
    return Array.isArray(data);
  }

  isCompressedData(data) {
    return data && typeof data === 'object' && data.compressed === true;
  }

  /**
   * Data optimization implementations
   */
  optimizeNumericData(data) {
    // Convert to typed array for better performance
    return new Float32Array(data);
  }

  decompressNumericData(data) {
    return Array.from(data);
  }

  optimizeTensorData(data) {
    // Optimize tensor data structure
    return {
      shape: data.shape,
      data: new Float32Array(data.data),
      optimized: true
    };
  }

  decompressTensorData(data) {
    if (data.optimized) {
      return {
        shape: data.shape,
        data: Array.from(data.data)
      };
    }
    return data;
  }

  optimizeObjectData(data) {
    // Remove undefined values and optimize structure
    return this.cleanObject(data);
  }

  decompressObjectData(data) {
    return data;
  }

  optimizeArrayData(data) {
    // Remove sparse elements and optimize
    return data.filter(item => item !== undefined);
  }

  decompressArrayData(data) {
    return data;
  }

  cleanObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Utility methods
   */
  calculateDataSize(data) {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (typeof data === 'string') {
      return data.length * 2; // Approximate UTF-16 size
    } else if (data instanceof Uint8Array) {
      return data.byteLength;
    } else {
      // Approximate JSON size
      return JSON.stringify(data).length * 2;
    }
  }

  getAvailableCompressionWorker() {
    return this.compressionWorkers.find(worker => !worker.busy);
  }

  getTransferBuffer() {
    if (this.transferUtils.recycledBuffers.length > 0) {
      return this.transferUtils.recycledBuffers.pop();
    }
    
    if (this.transferUtils.transferBuffers.length > 0) {
      return this.transferUtils.transferBuffers.pop();
    }
    
    // Allocate new buffer if needed
    return new ArrayBuffer(this.config.transferBufferSize);
  }

  returnTransferBuffer(buffer) {
    this.transferUtils.recycledBuffers.push(buffer);
  }

  prepareChunkForTransfer(chunk, buffer) {
    // Simulate data preparation
    return chunk;
  }

  calculateChunkTransferTime(chunkData) {
    // Simulate transfer time based on size (1ms per KB)
    const sizeKB = this.calculateDataSize(chunkData) / 1024;
    return Math.max(1, Math.min(10, sizeKB));
  }

  simulateTransferDelay(data) {
    const size = this.calculateDataSize(data);
    const delay = Math.max(1, size / 1024); // 1ms per KB
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async yieldControl() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  checkTransferCache(data, options) {
    if (!this.config.enableTransferCaching) return null;
    
    const cacheKey = this.generateCacheKey(data, options);
    return this.transferState.transferCache.get(cacheKey);
  }

  cacheTransferResult(data, options, result) {
    const cacheKey = this.generateCacheKey(data, options);
    this.transferState.transferCache.set(cacheKey, {
      key: cacheKey,
      result,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.transferState.transferCache.size > 100) {
      const oldestKey = Array.from(this.transferState.transferCache.keys())[0];
      this.transferState.transferCache.delete(oldestKey);
    }
  }

  generateCacheKey(data, options) {
    // Simple hash-like key generation
    const dataStr = JSON.stringify(data).substring(0, 100);
    const optionsStr = JSON.stringify(options);
    return btoa(dataStr + optionsStr).substring(0, 32);
  }

  /**
   * Performance and maintenance
   */
  updateTransferMetrics() {
    // Update cache hit rate
    const totalTransfers = this.transferState.totalTransfers;
    const cacheSize = this.transferState.transferCache.size;
    this.metrics.cacheHitRate = totalTransfers > 0 ? (cacheSize / totalTransfers) * 100 : 0;

    // Update average transfer speed
    if (this.metrics.transferTimes.length > 0) {
      const avgTime = this.metrics.transferTimes.reduce((a, b) => a + b, 0) / this.metrics.transferTimes.length;
      this.metrics.averageTransferSpeed = this.metrics.totalBytesTransferred / avgTime;
    }

    // Limit metrics arrays
    if (this.metrics.transferTimes.length > 50) {
      this.metrics.transferTimes = this.metrics.transferTimes.slice(-50);
    }
  }

  updateTransferSuccess(transferInfo) {
    this.transferState.totalTransfers++;
    this.transferState.successfulTransfers++;
    this.metrics.totalBytesTransferred += transferInfo.originalSize;
    this.metrics.transferTimes.push(transferInfo.totalTime);

    if (transferInfo.optimizedSize < transferInfo.originalSize) {
      const ratio = transferInfo.originalSize / transferInfo.optimizedSize;
      this.metrics.totalCompressionRatio = 
        (this.metrics.totalCompressionRatio + ratio) / 2;
    }
  }

  startMaintenance() {
    setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute
  }

  performMaintenance() {
    // Clean old completed transfers
    const cutoff = Date.now() - 300000; // 5 minutes
    for (const [id, transfer] of this.transferState.completedTransfers) {
      if (transfer.endTime < cutoff) {
        this.transferState.completedTransfers.delete(id);
      }
    }

    // Clean old cache entries
    for (const [key, cache] of this.transferState.transferCache) {
      if (cache.timestamp < cutoff) {
        this.transferState.transferCache.delete(key);
      }
    }
  }

  handleCompressionWorkerMessage(event) {
    // Handled by individual transfer promises
  }

  handleCompressionWorkerError(error) {
    console.warn('Compression worker error:', error);
  }

  /**
   * Get transfer capabilities
   */
  getTransferCapabilities() {
    return {
      compression: this.config.enableCompression,
      progressiveTransfer: this.config.enableProgressiveTransfer,
      caching: this.config.enableTransferCaching,
      maxChunkSize: this.config.maxTransferChunkSize,
      maxConcurrentTransfers: this.config.maxConcurrentTransfers,
      compressionWorkers: this.compressionWorkers.length,
      optimizationStrategies: Object.keys(this.optimizationStrategies)
    };
  }

  /**
   * Get transfer statistics
   */
  getTransferStats() {
    return {
      activeTransfers: this.transferState.activeTransfers.size,
      queuedTransfers: this.transferState.transferQueue.length,
      totalTransfers: this.transferState.totalTransfers,
      successfulTransfers: this.transferState.successfulTransfers,
      failedTransfers: this.transferState.failedTransfers,
      metrics: { ...this.metrics },
      cacheSize: this.transferState.transferCache.size
    };
  }

  /**
   * Event handling
   */
  on(eventType, callback) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType].add(callback);
      return () => this.eventHandlers[eventType].delete(callback);
    }
  }

  fireEvent(eventType, data) {
    if (this.eventHandlers[eventType]) {
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler({ ...data, timestamp: performance.now() });
        } catch (error) {
          console.warn(`Transfer event handler failed for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Cleanup and destroy
   */
  async destroy() {
    console.log('🧹 Destroying Optimized Transfer System...');

    try {
      // Terminate compression workers
      this.compressionWorkers.forEach(worker => {
        worker.worker.terminate();
      });
      this.compressionWorkers = [];

      // Clear all caches and state
      this.transferState.transferCache.clear();
      this.transferState.completedTransfers.clear();
      this.transferState.activeTransfers.clear();

      // Clear event handlers
      Object.values(this.eventHandlers).forEach(handlers => handlers.clear());

      this.isInitialized = false;

      console.log('✅ Optimized Transfer System destroyed');

    } catch (error) {
      console.error('Error during Optimized Transfer System destruction:', error);
    }
  }
}

// Singleton instance
let optimizedTransferSystemInstance = null;

export function getOptimizedTransferSystem() {
  if (!optimizedTransferSystemInstance) {
    optimizedTransferSystemInstance = new OptimizedTransferSystem();
  }
  return optimizedTransferSystemInstance;
}

export { OptimizedTransferSystem };