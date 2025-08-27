document.addEventListener('DOMContentLoaded', function() {
            // DOM elements
            const playBtn = document.getElementById('play');
            const prevBtn = document.getElementById('prev');
            const nextBtn = document.getElementById('next');
            const shuffleBtn = document.getElementById('shuffle');
            const repeatBtn = document.getElementById('repeat');
            const volumeSlider = document.getElementById('volume');
            const volumeProgress = document.getElementById('volume-progress');
            const volumeHandle = document.getElementById('volume-handle');
            const volumeContainer = document.getElementById('volume-container');
            const volumePercentage = document.getElementById('volume-percentage');
            const volumeIcon = document.getElementById('volume-icon');
            const progressContainer = document.getElementById('progress-container');
            const progress = document.getElementById('progress');
            const progressHandle = document.getElementById('progress-handle');
            const currentTimeEl = document.getElementById('current-time');
            const durationEl = document.getElementById('duration');
            const songTitleEl = document.getElementById('song-title');
            const albumArtEl = document.getElementById('album-art');
            const fileInput = document.getElementById('file-input');
            const uploadArea = document.getElementById('upload-area');
            const playlistEl = document.getElementById('playlist');
            const bitrateEl = document.getElementById('bitrate');
            
            // Audio context and variables
            const audio = new Audio();
            let isPlaying = false;
            let isShuffleActive = false;
            let repeatMode = 0; // 0: off, 1: repeat current, 2: repeat current once
            let currentSongIndex = 0;
            let songs = [];
            let shuffleOrder = [];
            let isDragging = false;
            let isVolumeDragging = false;
            let currentObjectUrl = null;
            let wasPlayingBeforeDrag = false;
            let uploadedFiles = new Set();
            let hasRepeatedOnce = false;
            
            // Set default volume to 50%
            audio.volume = 0.5;
            
            // Format time function
            function formatTime(seconds) {
                const min = Math.floor(seconds / 60);
                const sec = Math.floor(seconds % 60);
                return `${min}:${sec < 10 ? '0' : ''}${sec}`;
            }
            
            // Generate a unique identifier for a file (name + size)
            function getFileIdentifier(file) {
                return `${file.name}-${file.size}`;
            }
            
            // Check if a file is a duplicate
            function isDuplicateFile(file) {
                return uploadedFiles.has(getFileIdentifier(file));
            }
            
            // Update volume display
            function updateVolumeDisplay() {
                const volume = audio.volume;
                const percentage = Math.round(volume * 100);
                volumePercentage.textContent = `${percentage}%`;
                volumeProgress.style.width = `${percentage}%`;
                volumeHandle.style.left = `${percentage}%`;
                
                // Update volume icon based on volume level
                if (volume === 0) {
                    volumeIcon.className = 'fas fa-volume-mute';
                } else if (volume < 0.5) {
                    volumeIcon.className = 'fas fa-volume-down';
                } else {
                    volumeIcon.className = 'fas fa-volume-up';
                }
            }
            
            // Update repeat button display
            function updateRepeatButton() {
                const repeatTitles = ["Repeat Off", "Repeat Current Song", "Repeat Current Once"];
                repeatBtn.title = repeatTitles[repeatMode];
                
                // Remove all state classes
                repeatBtn.classList.remove('active');
                repeatBtn.classList.remove('repeat-one');
                
                if (repeatMode === 0) {
                    // Repeat off - no additional styling
                } else if (repeatMode === 1) {
                    // Repeat current - active with standard icon
                    repeatBtn.classList.add('active');
                } else if (repeatMode === 2) {
                    // Repeat current once - active with "1" instead of icon
                    repeatBtn.classList.add('active');
                    repeatBtn.classList.add('repeat-one');
                }
            }
            
            // Generate shuffle order
            function generateShuffleOrder() {
                shuffleOrder = [...Array(songs.length).keys()];
                for (let i = shuffleOrder.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
                }
                
                // Make sure current song isn't first in shuffle order
                if (shuffleOrder[0] === currentSongIndex && songs.length > 1) {
                    const randomIndex = Math.floor(Math.random() * (shuffleOrder.length - 1)) + 1;
                    [shuffleOrder[0], shuffleOrder[randomIndex]] = [shuffleOrder[randomIndex], shuffleOrder[0]];
                }
                
                return shuffleOrder.indexOf(currentSongIndex);
            }
            
            // Get next song index based on shuffle mode
            function getNextIndex() {
                if (!isShuffleActive || songs.length <= 1) {
                    return (currentSongIndex + 1) % songs.length;
                }
                
                const currentShuffleIndex = shuffleOrder.indexOf(currentSongIndex);
                return shuffleOrder[(currentShuffleIndex + 1) % shuffleOrder.length];
            }
            
            // Get previous song index based on shuffle mode
            function getPrevIndex() {
                if (!isShuffleActive || songs.length <= 1) {
                    return (currentSongIndex - 1 + songs.length) % songs.length;
                }
                
                const currentShuffleIndex = shuffleOrder.indexOf(currentSongIndex);
                return shuffleOrder[(currentShuffleIndex - 1 + shuffleOrder.length) % shuffleOrder.length];
            }
            
            // Simple audio analysis without heavy processing
            function analyzeAudioFile(file, callback) {
                // Create a temporary audio element to get basic info
                const tempAudio = new Audio();
                const objectUrl = URL.createObjectURL(file);
                
                tempAudio.addEventListener('loadedmetadata', function() {
                    const duration = tempAudio.duration;
                    const bitrate = duration > 0 ? Math.round((file.size * 8) / duration / 1000) : 0;
                    
                    // Clean up the object URL
                    URL.revokeObjectURL(objectUrl);
                    
                    callback({
                        duration,
                        bitrate,
                        estimated: true
                    });
                });
                
                tempAudio.addEventListener('error', function() {
                    // If we can't load the file, provide estimates
                    callback({
                        duration: 0,
                        bitrate: 0,
                        error: "Failed to analyze file"
                    });
                    
                    // Clean up the object URL
                    URL.revokeObjectURL(objectUrl);
                });
                
                tempAudio.src = objectUrl;
                tempAudio.load();
            }
            
            // Scroll to active playlist item
            function scrollToActiveItem() {
                const activeItem = playlistEl.querySelector('.playlist-item.active');
                if (activeItem) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            
            // Update playlist highlights
            function updatePlaylistHighlight(index) {
                const playlistItems = playlistEl.querySelectorAll('.playlist-item');
                playlistItems.forEach((item, idx) => {
                    if (idx === index) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
                
                // Scroll to the active item
                scrollToActiveItem();
            }
            
            // Play a song
            function playSong(index) {
                if (songs.length === 0) return;
                
                // Clean up previous object URL to free memory
                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                    currentObjectUrl = null;
                }
                
                currentSongIndex = index;
                const song = songs[currentSongIndex];
                
                // Create object URL for the file
                currentObjectUrl = URL.createObjectURL(song.file);
                audio.src = currentObjectUrl;
                
                // Update UI
                songTitleEl.textContent = song.name;
                
                // Display audio information if available
                if (song.audioInfo) {
                    updateAudioInfo(song.audioInfo);
                } else {
                    // Analyze the file if we haven't already
                    analyzeAudioFile(song.file, function(audioInfo) {
                        song.audioInfo = audioInfo;
                        updateAudioInfo(audioInfo);
                        
                        // Update playlist item with info
                        const playlistItems = playlistEl.querySelectorAll('.playlist-item');
                        if (playlistItems[index]) {
                            const infoSpan = playlistItems[index].querySelector('.file-info');
                            if (infoSpan) {
                                let infoText = audioInfo.bitrate > 0 ? `${audioInfo.bitrate}kbps` : 'Unknown';
                                if (audioInfo.duration > 0) {
                                    infoText += ` · ${Math.round(audioInfo.duration)}s`;
                                }
                                infoSpan.innerHTML = infoText;
                            }
                        }
                    });
                }
                
                // Play the audio
                audio.play();
                isPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.title = "Pause";
                
                // Update playlist highlights
                updatePlaylistHighlight(currentSongIndex);
                
                // Reset the repeat once flag
                hasRepeatedOnce = false;
            }
            
            // Update audio information display
            function updateAudioInfo(audioInfo) {
                bitrateEl.textContent = `Bitrate: ${audioInfo.bitrate > 0 ? audioInfo.bitrate + ' kbps' : 'Unknown'}`;
            }
            
            // Pause the song
            function pauseSong() {
                audio.pause();
                isPlaying = false;
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.title = "Play";
            }
            
            // Next song
            function nextSong() {
                if (songs.length === 0) return;
                
                const nextIndex = getNextIndex();
                playSong(nextIndex);
            }
            
            // Previous song
            function prevSong() {
                if (songs.length === 0) return;
                
                const prevIndex = getPrevIndex();
                playSong(prevIndex);
            }
            
            // Toggle shuffle
            function toggleShuffle() {
                isShuffleActive = !isShuffleActive;
                
                if (isShuffleActive) {
                    shuffleBtn.classList.add('active');
                    shuffleBtn.title = "Disable shuffle";
                    generateShuffleOrder();
                } else {
                    shuffleBtn.classList.remove('active');
                    shuffleBtn.title = "Enable shuffle";
                }
            }
            
            // Toggle repeat mode
            function toggleRepeat() {
                repeatMode = (repeatMode + 1) % 3;
                updateRepeatButton();
                
                // Reset the repeat once flag when changing modes
                hasRepeatedOnce = false;
            }
            
            // Update progress bar and handle position
            function updateProgress() {
                const { duration, currentTime } = audio;
                if (isNaN(duration) || duration === 0) return;
                
                const progressPercent = (currentTime / duration) * 100;
                progress.style.width = `${progressPercent}%`;
                
                // Update handle position - use percentage of container width
                const containerWidth = progressContainer.offsetWidth;
                const handlePosition = (progressPercent / 100) * containerWidth;
                progressHandle.style.left = `${handlePosition}px`;
                
                currentTimeEl.textContent = formatTime(currentTime);
                durationEl.textContent = formatTime(duration);
            }
            
            // Set progress on click or drag
            function setProgress(clientX, updateAudio = true) {
                const progressRect = progressContainer.getBoundingClientRect();
                let clickX = clientX - progressRect.left;
                clickX = Math.max(0, Math.min(progressRect.width, clickX));
                
                const progressPercent = (clickX / progressRect.width) * 100;
                progress.style.width = `${progressPercent}%`;
                
                // Update handle position
                progressHandle.style.left = `${clickX}px`;
                
                // Update time display
                if (audio.duration) {
                    const newTime = (clickX / progressRect.width) * audio.duration;
                    currentTimeEl.textContent = formatTime(newTime);
                    
                    // Update audio position if requested
                    if (updateAudio) {
                        audio.currentTime = newTime;
                    }
                }
            }
            
            // Set volume progress on click or drag
            function setVolumeProgress(clientX) {
                const volumeRect = volumeContainer.getBoundingClientRect();
                let clickX = clientX - volumeRect.left;
                clickX = Math.max(0, Math.min(volumeRect.width, clickX));
                
                const volumePercent = clickX / volumeRect.width;
                audio.volume = volumePercent;
                volumeSlider.value = volumePercent;
                updateVolumeDisplay();
            }
            
            // Initialize drag functionality
            function initDragHandle() {
                // Progress bar dragging
                progressHandle.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    progressHandle.classList.add('dragging');
                    e.preventDefault();
                    
                    // Store whether audio was playing before drag
                    wasPlayingBeforeDrag = isPlaying;
                    
                    // Pause audio during dragging for smoother experience
                    if (isPlaying) {
                        audio.pause();
                    }
                    
                    function dragMove(e) {
                        if (!isDragging) return;
                        
                        // Use requestAnimationFrame for smoother dragging
                        requestAnimationFrame(() => {
                            setProgress(e.clientX, false);
                        });
                    }
                    
                    function dragEnd(e) {
                        isDragging = false;
                        progressHandle.classList.remove('dragging');
                        document.removeEventListener('mousemove', dragMove);
                        document.removeEventListener('mouseup', dragEnd);
                        
                        // Set the final audio position
                        setProgress(e.clientX, true);
                        
                        // Resume playback if it was playing before drag
                        if (wasPlayingBeforeDrag) {
                            audio.play();
                        }
                    }
                    
                    document.addEventListener('mousemove', dragMove);
                    document.addEventListener('mouseup', dragEnd);
                });
                
                // Volume handle dragging
                volumeHandle.addEventListener('mousedown', function(e) {
                    isVolumeDragging = true;
                    volumeHandle.classList.add('dragging');
                    e.preventDefault();
                    
                    function dragMove(e) {
                        if (!isVolumeDragging) return;
                        
                        // Use requestAnimationFrame for smoother dragging
                        requestAnimationFrame(() => {
                            setVolumeProgress(e.clientX);
                        });
                    }
                    
                    function dragEnd(e) {
                        isVolumeDragging = false;
                        volumeHandle.classList.remove('dragging');
                        document.removeEventListener('mousemove', dragMove);
                        document.removeEventListener('mouseup', dragEnd);
                    }
                    
                    document.addEventListener('mousemove', dragMove);
                    document.addEventListener('mouseup', dragEnd);
                });
                
                // Also allow clicking on the progress container to seek
                progressContainer.addEventListener('click', (e) => {
                    if (!isDragging) {
                        setProgress(e.clientX, true);
                    }
                });
                
                // Allow clicking on the volume container to set volume
                volumeContainer.addEventListener('click', (e) => {
                    if (!isVolumeDragging) {
                        setVolumeProgress(e.clientX);
                    }
                });
            }
            
            // Update volume
            function setVolume() {
                audio.volume = volumeSlider.value;
                updateVolumeDisplay();
            }
            
            // Handle file uploads with memory management
            function handleFiles(files) {
                // Clear playlist if it's the placeholder
                if (songs.length === 0) {
                    playlistEl.innerHTML = '';
                }
                
                // Process files with a delay to prevent UI freezing
                processFilesInBatches(files, 0);
            }
            
            // Process files in batches to prevent browser freezing
            function processFilesInBatches(files, index) {
                if (index >= files.length) return;
                
                // Process a batch of 5 files at a time
                const batchSize = 5;
                const batchEnd = Math.min(index + batchSize, files.length);
                
                for (let i = index; i < batchEnd; i++) {
                    const file = files[i];
                    
                    // Only process audio files
                    if (!file.type.startsWith('audio/')) {
                        alert(`Skipping ${file.name} - not an audio file`);
                        continue;
                    }
                    
                    // Check for duplicate files
                    if (isDuplicateFile(file)) {
                        continue;
                    }
                    
                    // Add to songs array
                    songs.push({
                        name: file.name,
                        file: file,
                        audioInfo: null
                    });
                    
                    // Add to uploaded files set
                    uploadedFiles.add(getFileIdentifier(file));
                    
                    // Create playlist item
                    const playlistItem = document.createElement('div');
                    playlistItem.className = 'playlist-item';
                    playlistItem.dataset.index = songs.length - 1;
                    playlistItem.innerHTML = `
                        <span class="file-name">${file.name}</span>
                    `;
                    
                    // Play when clicked
                    playlistItem.addEventListener('click', () => {
                        const songIndex = parseInt(playlistItem.dataset.index);
                        playSong(songIndex);
                    });
                    
                    playlistEl.appendChild(playlistItem);
                }
                
                // Process next batch after a delay
                if (batchEnd < files.length) {
                    setTimeout(() => {
                        processFilesInBatches(files, batchEnd);
                    }, 100);
                }
            }
            
            // Event listeners
            playBtn.addEventListener('click', () => {
                if (songs.length === 0) {
                    alert('Please upload a song first');
                    return;
                }
                
                if (isPlaying) {
                    pauseSong();
                } else {
                    audio.play();
                    isPlaying = true;
                    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    playBtn.title = "Pause";
                }
            });
            
            prevBtn.addEventListener('click', prevSong);
            nextBtn.addEventListener('click', nextSong);
            shuffleBtn.addEventListener('click', toggleShuffle);
            repeatBtn.addEventListener('click', toggleRepeat);
            volumeSlider.addEventListener('input', setVolume);
            audio.addEventListener('timeupdate', updateProgress);
            audio.addEventListener('ended', () => {
                if (repeatMode === 1) { 
                    // Repeat current song indefinitely
                    audio.currentTime = 0;
                    audio.play();
                } else if (repeatMode === 2) { 
                    // Repeat current song only once
                    if (!hasRepeatedOnce) {
                        // First time ending - replay the song
                        audio.currentTime = 0;
                        audio.play();
                        hasRepeatedOnce = true;
                    } else {
                        // Second time ending - move to next song
                        nextSong();
                    }
                } else {
                    // No repeat - move to next song
                    nextSong();
                }
            });
            
            // File upload handling
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', () => {
                handleFiles(fileInput.files);
                fileInput.value = '';
            });

            // Initialize drag handle functionality
            initDragHandle();
            
            // Initialize volume display
            updateVolumeDisplay();
            
            // Initialize repeat button
            updateRepeatButton();
            
            // Clean up object URLs when leaving the page
            window.addEventListener('beforeunload', () => {
                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                }
            });
        });