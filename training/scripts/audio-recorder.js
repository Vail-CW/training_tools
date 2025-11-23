/**
 * Audio Recorder - MP3 Recording for Free Practice
 *
 * Records morse code sidetone audio and encodes to MP3 using lamejs
 * Provides playback preview before download
 *
 * @author Vail Training Tools
 * @license MIT
 */

class AudioRecorder {
	constructor(sourceNode, audioContext) {
		this.sourceNode = sourceNode;
		this.audioContext = audioContext;
		this.isRecording = false;
		this.startTime = null;
		this.recordingDuration = 0;
		this.sampleRate = 44100;
		this.maxDuration = 600; // 10 minutes in seconds

		// PCM buffers (Float32Array)
		this.leftChannel = [];
		this.rightChannel = [];
		this.recordingLength = 0;

		// MP3 encoder
		this.mp3Encoder = null;
		this.mp3Data = [];

		// ScriptProcessorNode for capturing audio
		this.processor = null;
		this.bufferSize = 8192;  // Larger buffer for smoother recording

		// Recording timer
		this.timer = null;
		this.onTimeUpdate = null;

		// Check if lamejs is available
		if (typeof lamejs === 'undefined') {
			console.error('lamejs library not loaded! MP3 encoding will not work.');
		}
	}

	/**
	 * Start recording audio from the source node
	 * @param {Function} onTimeUpdate - Callback for recording time updates (seconds)
	 */
	start(onTimeUpdate) {
		if (this.isRecording) {
			console.warn('Already recording');
			return;
		}

		console.log('AudioRecorder: Starting recording...');

		this.isRecording = true;
		this.startTime = Date.now();
		this.recordingDuration = 0;
		this.onTimeUpdate = onTimeUpdate || function() {};

		// Clear previous recording
		this.leftChannel = [];
		this.rightChannel = [];
		this.recordingLength = 0;
		this.mp3Data = [];

		// Create ScriptProcessorNode for audio capture
		// Note: Must have at least 1 input channel to receive audio
		this.processor = this.audioContext.createScriptProcessor(
			this.bufferSize,
			1, // Input channels (mono)
			1  // Output channels (mono pass-through)
		);

		// Capture audio samples
		this.processor.onaudioprocess = (e) => {
			if (!this.isRecording) return;

			// Check max duration (10 minutes)
			const currentDuration = (Date.now() - this.startTime) / 1000;
			if (currentDuration >= this.maxDuration) {
				console.warn('Max recording duration reached (10 minutes). Stopping...');
				this.stop();
				return;
			}

			// Get audio data (mono input)
			const input = e.inputBuffer.getChannelData(0);

			// Clone the data for both channels (Float32Array)
			// Duplicate mono to stereo for MP3 encoding
			this.leftChannel.push(new Float32Array(input));
			this.rightChannel.push(new Float32Array(input));
			this.recordingLength += input.length;
		};

		// Connect the audio graph
		// sourceNode → processor → destination (pass-through for recording)
		// The processor captures audio while passing it through
		this.sourceNode.connect(this.processor);
		this.processor.connect(this.audioContext.destination);

		// Start timer for UI updates
		this.timer = setInterval(() => {
			this.recordingDuration = (Date.now() - this.startTime) / 1000;
			this.onTimeUpdate(this.recordingDuration);

			// Warn if approaching max duration
			if (this.recordingDuration > this.maxDuration - 30) {
				console.warn(`Approaching max recording duration: ${Math.round(this.maxDuration - this.recordingDuration)}s remaining`);
			}
		}, 1000);

		console.log('AudioRecorder: Recording started');
	}

	/**
	 * Stop recording
	 */
	stop() {
		if (!this.isRecording) {
			console.warn('Not recording');
			return;
		}

		console.log('AudioRecorder: Stopping recording...');

		this.isRecording = false;
		this.recordingDuration = (Date.now() - this.startTime) / 1000;

		// Stop timer
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		// Disconnect processor
		if (this.processor) {
			this.processor.disconnect();
			this.sourceNode.disconnect(this.processor);
			this.processor = null;
		}

		console.log(`AudioRecorder: Recording stopped. Duration: ${this.recordingDuration.toFixed(2)}s, Samples: ${this.recordingLength}`);
	}

	/**
	 * Encode recorded audio to MP3
	 * @returns {Blob} MP3 audio blob
	 */
	encodeToMP3() {
		if (!this.leftChannel.length) {
			throw new Error('No audio data to encode');
		}

		if (typeof lamejs === 'undefined') {
			throw new Error('lamejs library not loaded');
		}

		console.log('AudioRecorder: Encoding to MP3...');

		// Merge all Float32Array chunks into single arrays
		const leftData = this.mergeBuffers(this.leftChannel, this.recordingLength);
		const rightData = this.mergeBuffers(this.rightChannel, this.recordingLength);

		// Convert Float32 (-1.0 to +1.0) to Int16 (-32768 to +32767)
		const leftInt16 = this.floatTo16BitPCM(leftData);
		const rightInt16 = this.floatTo16BitPCM(rightData);

		// Initialize MP3 encoder
		// Parameters: channels, sample rate, bitrate (kbps)
		// Higher bitrate (192 kbps) for better quality and less artifacts
		const mp3encoder = new lamejs.Mp3Encoder(2, this.sampleRate, 192);
		const mp3Data = [];

		// Encode in chunks
		const chunkSize = 1152; // LAME encoding frame size
		for (let i = 0; i < leftInt16.length; i += chunkSize) {
			const leftChunk = leftInt16.subarray(i, i + chunkSize);
			const rightChunk = rightInt16.subarray(i, i + chunkSize);

			const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
			if (mp3buf.length > 0) {
				mp3Data.push(mp3buf);
			}
		}

		// Flush remaining data
		const mp3buf = mp3encoder.flush();
		if (mp3buf.length > 0) {
			mp3Data.push(mp3buf);
		}

		// Create Blob from MP3 data
		const blob = new Blob(mp3Data, { type: 'audio/mp3' });

		console.log(`AudioRecorder: MP3 encoding complete. Size: ${(blob.size / 1024).toFixed(2)} KB`);

		return blob;
	}

	/**
	 * Merge multiple Float32Array buffers into one
	 */
	mergeBuffers(channelBuffers, recordingLength) {
		const result = new Float32Array(recordingLength);
		let offset = 0;
		for (let i = 0; i < channelBuffers.length; i++) {
			result.set(channelBuffers[i], offset);
			offset += channelBuffers[i].length;
		}
		return result;
	}

	/**
	 * Convert Float32 audio (-1.0 to +1.0) to Int16 PCM (-32768 to +32767)
	 */
	floatTo16BitPCM(input) {
		const output = new Int16Array(input.length);
		for (let i = 0; i < input.length; i++) {
			const s = Math.max(-1, Math.min(1, input[i])); // Clamp
			output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}
		return output;
	}

	/**
	 * Create an Object URL for the audio blob (for playback preview)
	 * @param {Blob} blob - MP3 audio blob
	 * @returns {string} Object URL
	 */
	createAudioURL(blob) {
		return URL.createObjectURL(blob);
	}

	/**
	 * Download the MP3 file
	 * @param {Blob} blob - MP3 audio blob
	 * @param {string} filename - Filename for download
	 */
	downloadMP3(blob, filename) {
		const url = this.createAudioURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = filename || this.generateFilename();
		document.body.appendChild(a);
		a.click();

		// Cleanup
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);

		console.log(`AudioRecorder: Download triggered for ${filename}`);
	}

	/**
	 * Generate filename with timestamp
	 * Format: vail-practice-YYYYMMDD-HHMMSS.mp3
	 */
	generateFilename() {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');

		return `vail-practice-${year}${month}${day}-${hours}${minutes}${seconds}.mp3`;
	}

	/**
	 * Format duration in MM:SS format
	 * @param {number} seconds - Duration in seconds
	 * @returns {string} Formatted duration
	 */
	static formatDuration(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${String(secs).padStart(2, '0')}`;
	}

	/**
	 * Get current recording status
	 */
	getStatus() {
		return {
			isRecording: this.isRecording,
			duration: this.recordingDuration,
			formattedDuration: AudioRecorder.formatDuration(this.recordingDuration),
			maxDuration: this.maxDuration,
			remainingTime: this.maxDuration - this.recordingDuration
		};
	}

	/**
	 * Reset the recorder
	 */
	reset() {
		if (this.isRecording) {
			this.stop();
		}

		this.leftChannel = [];
		this.rightChannel = [];
		this.recordingLength = 0;
		this.mp3Data = [];
		this.recordingDuration = 0;
		this.startTime = null;
	}
}

// Make available globally
if (typeof window !== 'undefined') {
	window.AudioRecorder = AudioRecorder;
}
