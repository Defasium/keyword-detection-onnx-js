//XMLHttpRequest.prototype.send = () => false;
const sampleAudioData = {};

(function(window, undefined) {
    const {
        createWorker
    } = FFmpeg;
    var FILES;
    let filesDurationMap = {};
    const ENV_TYPE = location.hostname === '' ? 'offline' : 'online';
    const TEST_FILE = (lang) => `scripts/demo/test.${lang}.b64.js`;
    const INPUT_FILE = 'input.input';
    const AUDIO_FILE = 'output.wav';
    const SPECTROGRAM_FILE = 'output.apng';
    const ORT_WASM_FILE = 'scripts/onnxruntime/ort.wasm.b64.js';//location.hostname === '' ? 'scripts/onnxruntime/ort.wasm.b64.js' : 'https://raw.githubusercontent.com/Defasium/keyword-detection-onnx-js/main/scripts/onnxruntime/ort.wasm.b64.js';
    const ASR_MODEL_FILE = 'scripts/model/asr2.b64.js';
    const FLOATMAP = [];
    const UINT_8_MAX = 255;
    const DEFAULT_DURATION_CHUNK = 1000;
    const ONE_SECOND_IN_BYTES = 32000;
    const SPECTROGRAM_RESOLUTION_PER_SECOND = 32;
    const SPECTROGRAM_HEIGHT = 64;
    const COLOR_GREEN = '#A22525';
    const COLOR_RED = '#4CAF50';
    const IN_PERCENTS = 100;
    const MAX_CYCLES = 0x100;
    const SPECTROGRAM_HEIGHT_BORDERS = 128;
    const SPECTROGRAM_WIDTH_BORDERS = 260;
    const RGBA_PIXEL_SIZE = 4;
    const WAV_HEADERS_LENGTH = 78;
    const WAV_HEADERS_OFFSET = 8;
    const WAV_HEADERS_FILE_DURATION_BYTES = [4, 5, 6, 7];
    const WAV_HEADERS_DATA_DURATION_BYTES = [74, 75, 76, 77];

    const DOM_ELEMS = {
        getId: (name) => document.getElementById(name),
        getClass: (name) => document.getElementsByClassName(name),
        offset: 'offset',
        duration: 'duration',
        threshold: 'threshold',
        thresholdValue: 'thrval',
        message: 'message',
        audiofile: 'audiofile',
        outputAudio: 'output-video',
        timestamps: 'timestamps',
        undo: 'undo',
        copy: 'copy',
        next: 'next',
        prev: 'prev',
        number: 'number',
        uploader: 'uploader',
        settingsSvg: 'settings_svg',
        microphoneSvg: 'micro_svg',
        compute: 'compute',
        demoBtn: 'test',
        process: 'process',
        loadModel: 'model',
        progressRing: 'progring',
        progress: 'progress',
        innerRing: 'inner',
        dropZone: 'dropZone',
        actions: 'actions',
        expand: 'expand',
        progress: 'progress',
        content: 'content',
        resetEnv: 'reset',
        languageSwitch: 'lang_switcher',
        langRussian: 'lang_ru',
        langEnglish: 'lang_en',
        title: 'title',
        fileInfo: 'file_info',
        loadScreen: 'blocker',
    };

    const DOM_CSS = {
        visited: 'visited',
        highlight: 'highlight',
        group: 'group',
        icon: 'assets/icon.png',
        iconBusy: 'assets/icon_busy.png',
        svgX: 'assets/x-mark.svg',
        del: 'del',
    };

    for (let i = 0; i < UINT_8_MAX + 1; i += 1) {
        FLOATMAP[i] = i / UINT_8_MAX;
    }
    let audioData = new Uint8Array([]);
    const timestamps = [];
    const preds = [];
    const dump = [];
    const backup = [];
    let offset = 0;
    let lastName;
    let totalDuration = DEFAULT_DURATION_CHUNK;
    let isprocessed = false;
    let iscancel = false;
    const minThreshold = parseFloat(DOM_ELEMS.getId(DOM_ELEMS.threshold).min);
    var FFMPEGworker;
	let recorder;

    const INTERFACE = {
        LANG: {
            RU: 'ru',
            EN: 'en'
        },
        IDS: {
            loadScreen: ['Загрузка...', 'Loading...'],
            title: ['Детектирование временных меток', 'Timestamps detection'],
            fileInfo: ['Выберите или переместите один файл... (аудио или видео)',
                'Drag one file to this Drop Zone... (Audio or video)'
            ],
            demoBtn: ['Пример', 'Demo File'],
            process: ['Обработать весь файл', 'Compute All'],
            compute: ['Обработать один сегмент', 'Compute Segment'],
            resetEnv: ['Сброс', 'Reset'],
        },
        LABELS: {
            loadModel: ['Поменять модель', 'Update Model'],
            offset: ['Начало, с', 'Offset, s'],
            duration: ['Длительность, с', 'Duration, s'],
            threshold: ['Порог', 'Threshold'],
        },
        TITLES: {
            settingsSvg: ['Окно настроек', 'Settings menu'],
            microphoneSvg: ['Записать звук', 'Record audio'],
            group: [
                ['Предыдущая временная метка', 'Previous timestamp'],
                ['Следующая временная метка', 'Next timestamp'],
                ['Развернуть/свернуть список временных меток', 'Show/hide timestamps'],
            ],
        },
        IMG_TITLES: {
            undo: ['Отмена', 'Undo'],
            copy: ['Скопировать в буфер', 'Copy to buffer'],
        },
        MESSAGES: {
            ffmpegLoading: ['Загрузка ffmpeg.js...', 'Loading ffmpeg-core.js...'],
            audioConverting: ['Преобразование в аудио...', 'Converting to audio...'],
            audioMerging: ['Склеивание аудио сегментов...', 'Merging audio parts...'],
            spectrogramConverting: ['Получение спектрограммы...', 'Converting audio to spectrogram...'],
            spectrogramDecoding: ['Чтение файла спектрограммы...', 'Decoding spectrogram file...'],
            modelLoading: ['Загрузка модели распознавания...', 'Loading recognition model...'],
            timestampsPrediction: ['Поиск временных меток...', 'Predicting timestamps...'],
            complete: ['Завершено!', 'Complete!'],
        },
        userLang: (navigator.language || navigator.userLanguage).slice(0, 2),
        pos: 0,
        getOffset: function() {
            return this.userLang === this.LANG.RU ? 0 : 1;
        },
        updateInterface: function() {
            const pos = this.pos;
            DOM_ELEMS.getId(DOM_ELEMS.languageSwitch).getElementsByTagName('a')[pos].style.fontWeight = '1000';
            // clear message bar
            DOM_ELEMS.getId(DOM_ELEMS.message).textContent = '';
            let group;
            // update ids
            const elemsWithVals = [];
            group = this.IDS;
            for (const k in group) {
                if (group.hasOwnProperty(k)) {
                    let elem = DOM_ELEMS.getId(DOM_ELEMS[k]);
                    if (elem.children.length)
                        elem = elem.children[0];
                    elemsWithVals.push([elem, group[k][pos]]); //elem.textContent = group[k][pos];
                };
            };
            // update labels
            group = this.LABELS;
            for (const k in group) {
                if (group.hasOwnProperty(k)) {
                    let elem = DOM_ELEMS.getId(DOM_ELEMS[k]);
                    elemsWithVals.push([elem.parentElement.getElementsByTagName('label')[0], group[k][pos]])
                };
            };
            // update titles
            group = this.TITLES;
            for (const k in group) {
                if (group.hasOwnProperty(k)) {
                    let elem = DOM_ELEMS.getId(DOM_ELEMS[k]);
                    if (!elem) {
                        elem = DOM_ELEMS.getClass(DOM_CSS[k]);
                        let offset = 0;
                        [...elem].map(e => {
                            const collection = e.getElementsByTagName('title');
                            if (!collection.length) return;
                            elemsWithVals.push([collection[0], group[k][offset][pos]]);
                            offset += 1;
                        });
                    } else {
                        elemsWithVals.push([elem.getElementsByTagName('title')[0], group[k][pos]]);
                    };
                };
            };
            // update image titles
            group = this.IMG_TITLES;
            for (const k in group) {
                if (group.hasOwnProperty(k)) {
                    let elem = DOM_ELEMS.getId(DOM_ELEMS[k]);
                    elem.setAttribute('title', group[k][pos]);
                };
            };
            elemsWithVals.map(e => {
                e[0].textContent = e[1];
            });
        },
    };
    INTERFACE.pos = INTERFACE.getOffset();

    const changeInterface = (evt) => {
        const lang1 = DOM_ELEMS.langRussian;
        const lang2 = DOM_ELEMS.langEnglish;
        const elem = evt.target;
        elem.style.fontWeight = '1000';
        const otherElemId = elem.id === DOM_ELEMS.langRussian ? DOM_ELEMS.langEnglish : DOM_ELEMS.langRussian;
        DOM_ELEMS.getId(otherElemId).style.fontWeight = '1';
        INTERFACE.userLang = elem.id === DOM_ELEMS.langRussian ? INTERFACE.LANG.RU : INTERFACE.LANG.EN;
        INTERFACE.pos = INTERFACE.getOffset();
        INTERFACE.updateInterface();
    };

    const loadDemo = async () => {
        const lang = INTERFACE.userLang;
        new Promise((r, err) => {
            //const condition = [...document.getElementsByTagName('script')].map(e=>e.src.includes(TEST_FILE(userLang)));
            if (sampleAudioData.hasOwnProperty(lang)) {
                return r();
            }
            let s = document.createElement('script');
            s.src = TEST_FILE(lang);
            s.onload = r;
            s.onerror = err;
            document.body.appendChild(s);
        }).then((r) => {
            let demoBlob = base64toBlob(sampleAudioData[lang].split(',')[1]);
            const demoFile = new File([demoBlob], `demo_${lang}.mp3`);
            demoBlob = null;
            computeAll({
                target: {
                    files: [demoFile]
                }
            });
        }).catch((err) => {
            console.log(err);
        });
    };

    const initRecorder = async () => {
        recorder = await new Promise(async resolve => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                console.log(event.data);
                audioChunks.push(event.data);
            });

            const start = () => mediaRecorder.start();

            const stop = () =>
                new Promise(resolve => {
                    mediaRecorder.addEventListener("stop", () => {
                        const audioBlob = new Blob(audioChunks, {
                            type: "audio/mpeg"
                        });
                        audioChunks.length = 0;
                        resolve({
                            audioBlob
                        });
                    });

                    mediaRecorder.stop();
                    stream.getAudioTracks().forEach(track => track.stop());
                });

            resolve({
                start,
                stop,
                recording: false
            });
        });
    };

    const manageRecording = async (evt) => {
        //console.log(evt.srcElement);
        const elem = document.getElementById(DOM_ELEMS.microphoneSvg).children[0];
        if (!recorder) {
            await initRecorder();
        };
        if (recorder.recording) {
            const audio = await recorder.stop();
            elem.setAttribute('fill', '#000');
            recorder = null;
            //recordedURL = audio.audioUrl;
            const recordedAudio = new File([audio.audioBlob], `recordedAudio_${Date.now()}.mp3`);
            audio.audioBlob = null;
            FILES = {
                target: {
                    files: [recordedAudio]
                }
            };
            computeAll(FILES);
            DOM_ELEMS.getId(DOM_ELEMS.dropZone).style.display = 'block';
        } else {
            recorder.start();
            recorder.recording = true;
            elem.setAttribute('fill', '#f00');
            DOM_ELEMS.getId(DOM_ELEMS.dropZone).style.display = 'none';
        }
    };

    const base64toBlob = (base64Data, msg, contentType) => {
        console.time(msg);
        contentType = contentType || '';
        const sliceSize = 1024;
        const byteCharacters = atob(base64Data);
        const bytesLength = byteCharacters.length;
        const slicesCount = Math.ceil(bytesLength / sliceSize);
        const byteArrays = new Array(slicesCount);

        for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
            const begin = sliceIndex * sliceSize;
            const end = Math.min(begin + sliceSize, bytesLength);

            const bytes = new Array(end - begin);
            for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
                bytes[i] = byteCharacters[offset].charCodeAt(0);
            }
            byteArrays[sliceIndex] = new Uint8Array(bytes);
        }
        console.timeEnd(msg);
        return new Blob(byteArrays, {
            type: contentType
        });
    };

    const createURLfromHexObject = async (object, binding, msg) => {
        const tmp = URL.createObjectURL(base64toBlob(object, msg));
        for (let i = 0; i < binding.length; i += 1) {
            this[binding[i]] = tmp;
        };
        if (binding.length === 2) {
            DOM_ELEMS.getId(DOM_ELEMS.loadScreen).style.display = 'none';
        }
    };

    const initScripts = async () => {
        const elem = document.createElement('script');
        elem.type = 'text/javascript';
        elem.defer = true;
        elem.addEventListener('load', async () => {
            createURLfromHexObject(ortWasm, ['wasmBinaryFile', 'lt'], 'decode onnxWasm');
        });

        const elem2 = document.createElement('script');
        elem2.type = 'text/javascript';
        elem2.defer = true;
        elem2.addEventListener('load', async () => {
            createURLfromHexObject(modelHex, ['modelPath'], 'decode ASRmodel');
        });
        elem2.src = ASR_MODEL_FILE;
        if (ENV_TYPE === 'offline') {
            elem.src = ORT_WASM_FILE;
            document.getElementsByTagName('body')[0].appendChild(elem);
        } else {
            elem.remove();
	}
        document.getElementsByTagName('body')[0].appendChild(elem2);
    };

    const convertToArr = (hexarr, msg) => {
        result = []
        console.time(msg);
        for (let i = 0, length = hexarr.length; i < length; i += 2) {
            result.push(Number(`0x${hexarr[i]}${hexarr[i+1]}`));
        }
        console.timeEnd(msg);
        return result;
    };

    const parseDom = () => {
        const elems = {};
        elems.ss = parseInt(DOM_ELEMS.getId(DOM_ELEMS.offset).value);
        elems.dur = parseInt(DOM_ELEMS.getId(DOM_ELEMS.duration).value);
        elems.threshold = parseFloat(DOM_ELEMS.getId(DOM_ELEMS.threshold).value);
        elems.message = DOM_ELEMS.getId(DOM_ELEMS.message);
        elems.audio = DOM_ELEMS.getId(DOM_ELEMS.audiofile);
        elems.img = DOM_ELEMS.getId(DOM_ELEMS.outputAudio);
        elems.startOffset = parseInt(audioData.length / ONE_SECOND_IN_BYTES);
        elems.resolution = SPECTROGRAM_RESOLUTION_PER_SECOND;
        elems.height = SPECTROGRAM_HEIGHT;

        return elems;
    };

    const initWorker = async (elems) => {
        console.time('loading ffmpeg');
        elems.message.innerHTML = INTERFACE.MESSAGES.ffmpegLoading[INTERFACE.pos]; //'Loading ffmpeg-core.js';
        if (FFMPEGworker) {
            console.timeEnd('loading ffmpeg');
            return FFMPEGworker;
        }
        FFMPEGworker = createWorker();
        await FFMPEGworker.load();
        console.timeEnd('loading ffmpeg');
        return FFMPEGworker;
    };

    const convertAudio = async (elems) => {
        console.time('convert to audio');
        elems.message.innerHTML = INTERFACE.MESSAGES.audioConverting[INTERFACE.pos];
        await FFMPEGworker.run(
            `-y -threads 0 -ss ${elems.ss} -t ${elems.dur} -i ${INPUT_FILE} -map_metadata -1 -map 0:a:0 -acodec pcm_s16le -ac 1 -ar 16000 ${AUDIO_FILE}`, {
                //input: [elems.ss, elems.dur, elems.name],
                output: AUDIO_FILE,
            }
        ); // convert to mono 16bit 16kHz
        console.timeEnd('convert to audio');
    };

    const mergeAudioFiles = async (audioSlice) => {
        console.time('merge wavs');
        if (audioData.length < 1) {
            audioData = audioSlice;
        } else {
            const tmp = new Uint8Array(audioData.length + audioSlice.length - WAV_HEADERS_LENGTH);
            tmp.set(audioData);
            tmp.set(audioSlice.slice(WAV_HEADERS_LENGTH), audioData.length);
            // wav's duration flags update
            const length = tmp.length - WAV_HEADERS_OFFSET;
            tmp[WAV_HEADERS_FILE_DURATION_BYTES[0]] = length % UINT_8_MAX;
            tmp[WAV_HEADERS_FILE_DURATION_BYTES[1]] = Math.floor(length / UINT_8_MAX % UINT_8_MAX);
            tmp[WAV_HEADERS_FILE_DURATION_BYTES[2]] = Math.floor(length / (UINT_8_MAX << 8) % UINT_8_MAX);
            tmp[WAV_HEADERS_FILE_DURATION_BYTES[3]] = Math.floor(length / (UINT_8_MAX << 16) % UINT_8_MAX);
            tmp.set(tmp.slice(WAV_HEADERS_FILE_DURATION_BYTES[0], WAV_HEADERS_FILE_DURATION_BYTES[3] + 1), WAV_HEADERS_DATA_DURATION_BYTES[0]);
            audioData = tmp;
        }
        console.timeEnd('merge wavs');
    };

    const updateWav = async (elems) => {
        console.time('update wav');
        elems.message.innerHTML = INTERFACE.MESSAGES.audioMerging[INTERFACE.pos]; //'Merging audio parts...';
        const audioSlice = (await FFMPEGworker.read(AUDIO_FILE)).data;
        elems.width = Math.floor(audioSlice.length * SPECTROGRAM_RESOLUTION_PER_SECOND / ONE_SECOND_IN_BYTES);
        await mergeAudioFiles(audioSlice);
        if (elems.audio.src) {
            URL.revokeObjectURL(elems.audio.src);
        };
        elems.audio.src = URL.createObjectURL(
            new Blob([audioData.buffer], {
                type: 'audio/wav'
            })
        );
        console.timeEnd('update wav');
    };

    const convertToSpectrogram = async (elems) => {
        console.time('convert to spectrogram');
        elems.message.innerHTML = INTERFACE.MESSAGES.spectrogramConverting[INTERFACE.pos];
        await FFMPEGworker.run(
            `-y -threads 0 -loglevel quiet -i ${AUDIO_FILE} -lavfi showspectrumpic=s=${elems.width}x${elems.height}:scale=log:color=channel:gain=0.01 ${SPECTROGRAM_FILE}`, {
                output: SPECTROGRAM_FILE,
            }
        ); // generate spectrogram
        console.timeEnd('convert to spectrogram');
    };

    const readSpectrogram = async (elems) => {
        console.time('read image');
        elems.message.innerHTML = INTERFACE.MESSAGES.spectrogramDecoding[INTERFACE.pos];
        const {
            data
        } = await FFMPEGworker.read(SPECTROGRAM_FILE);
        console.timeEnd('read image');
        console.time('pngdecode');
        const spectrogram = UPNG.decode(data);
        const rgba = new Uint8Array(UPNG.toRGBA8(spectrogram)[0]);
        console.timeEnd('pngdecode');
        if (elems.img.src) {
            URL.revokeObjectURL(elems.img.src);
        };
        elems.img.src = URL.createObjectURL(
            new Blob([data.buffer], {
                type: 'image/png'
            })
        );
        elems.img.style.width = '100%';
        elems.img.style.height = '100px';
        return rgba;
    };

    const loadOrtSession = async (elems) => {
        console.time('load ONNX model');
        elems.message.innerHTML = INTERFACE.MESSAGES.modelLoading[INTERFACE.pos];
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ['wasm']
        });
        console.timeEnd('load ONNX model');
        return session;
    };

    const extractRedChannel = async (rgba) => {
        console.time('write RED channel');
        const r = [];
        for (let i = 0, total = rgba.length; i < total; i += RGBA_PIXEL_SIZE) {
            r.push(FLOATMAP[rgba[i]]);
        }
        console.timeEnd('write RED channel');
        return r;
    };

    const predictSpectrogram = async (elems, session, r) => {
        console.time('predict');
        elems.message.innerHTML = INTERFACE.MESSAGES.timestampsPrediction[INTERFACE.pos];
        const input = Float32Array.from(r);
        //const length = Int32Array.from([parseInt(width)]);
        const shape = [1, SPECTROGRAM_HEIGHT_BORDERS + elems.height, SPECTROGRAM_WIDTH_BORDERS + elems.width, 1];
        //const lshape = [1, 1];
        //const inputTensor = new onnx.Tensor(input, 'float32', shape);
        const inputTensor = new ort.Tensor('float32', input, shape);
        const feed = {
            input: inputTensor
        };
        const outputTensor = (await session.run(feed));
        console.timeEnd('predict');
        return outputTensor.output.data;
    };

    const transcode = async (args) => {
        //////////////////////
        const elems = parseDom();

        if (!FILES) {
            FILES = {
                target: args.target
            };
        }
        //////////////////////
        await initWorker(elems);
        //const worker = createWorker();
        elems.name = args.target.files[0].name;
        console.log(elems.name);
        if (!(await FFMPEGworker.ls('/')).data.includes(INPUT_FILE)) { //elems.name)) {
            //await FFMPEGworker.write(elems.name, args.target.files[0]);
            await FFMPEGworker.write(INPUT_FILE, args.target.files[0]);
        }
        /*if (lastName != name) {
            resetAudio();
            lastName = name;
            startOffset = 0;
        }*/
        await convertAudio(elems);
        await updateWav(elems);
        await convertToSpectrogram(elems);
        const rgba = await readSpectrogram(elems);
        const session = await loadOrtSession(elems);
        const r = await extractRedChannel(rgba);
        const predicts = await predictSpectrogram(elems, session, r);
        updateTimestamps(predicts, elems.startOffset, elems.threshold);
        elems.message.innerHTML = INTERFACE.MESSAGES.complete[INTERFACE.pos]; //'Complete!';
        elems.isLastSlice = elems.width < elems.dur * elems.resolution ? 1 : 0;
        return elems.isLastSlice;
    };

    const triggerNative = () => {
        if (FILES.target) {
            transcode(FILES);
        }
    };

    const readModel = async ({
        target: {
            files
        }
    }) => {
        let fr = new FileReader();
        fr.readAsArrayBuffer(files[0]);
        await new Promise((r) => (fr.onload = r));
        console.log(Array.from((new Uint8Array(fr.result))));
        modelPath = URL.createObjectURL(new Blob([(new Uint8Array(fr.result)).buffer]));
    };

    const updateAudio = async (ev) => {
        if (!timestamps.length) {
            return;
        }
        if (!ev.srcElement.name) {
            if (ev.target.closest('svg').id === DOM_ELEMS.next) {
                offset = (offset + 1) % timestamps.length;
            } else if (ev.target.closest('svg').id === DOM_ELEMS.prev) {
                offset -= 1;
                if (offset < 0) {
                    offset = timestamps.length - 1;
                }
            }
        } else {
            offset = timestamps.indexOf(parseInt(ev.srcElement.name));
            ev.srcElement.classList.add(DOM_CSS.visited);
            backup.push(timestamps[offset]);
        }
        message.innerHTML = convertTimestampToHMS(timestamps[offset]);
        DOM_ELEMS.getId(DOM_ELEMS.audiofile).currentTime = timestamps[offset];
    };

    const resetAudio = async () => {
        DOM_ELEMS.getId(DOM_ELEMS.timestamps).innerHTML = '';
        DOM_ELEMS.getId(DOM_ELEMS.copy).style.display = 'none';
        audioData = new Uint8Array([]);
        timestamps.length = 0;
        preds.length = 0;
        dump.length = 0;
        backup.length = 0;
    };

    const computeAll = async (args) => {
        if (!args.target.files.length) return;
        await resetAudio();
        if (args.target.files) {
            FILES = {
                target: args.target
            };
        }
        if (!FILES.target | isprocessed) {
            return;
        }
        const ss = DOM_ELEMS.getId(DOM_ELEMS.offset);
        const dur = DOM_ELEMS.getId(DOM_ELEMS.duration);
        ss.value = 0;
        dur.value = DEFAULT_DURATION_CHUNK;
        isprocessed = true;
        DOM_ELEMS.getId(DOM_ELEMS.microphoneSvg).style.display = 'none';
        getDuration();
        changeProgress();
        console.time('computeAll');
        for (let i = 0; i < MAX_CYCLES; i += 1) {
            if (iscancel) {
                changeCancel();
                break;
            }
            updateProgress();
            try {
                if (await transcode(FILES)) {
                    break;
                }
            } catch {
                break;
            }
            ss.value = parseInt(ss.value) + parseInt(dur.value);
            addTimestamps();
        }
        changeProgress();
        console.timeEnd('computeAll');
        addTimestamps();
        isprocessed = false;
        DOM_ELEMS.getId(DOM_ELEMS.microphoneSvg).style.display = 'block';
        if ((await FFMPEGworker.ls('/')).data.includes(INPUT_FILE)) { //FILES.target.files[0].name)) {
            await FFMPEGworker.remove(INPUT_FILE); //FILES.target.files[0].name);
        }
    };

    const changeProgress = async () => {
        const elem = DOM_ELEMS.getId(DOM_ELEMS.progressRing);
        if (elem.style.display === 'block') {
            elem.style.display = 'none';
            document.querySelector("link[rel*='icon']").href = DOM_CSS.icon;
        } else {
            elem.style.display = 'block';
            document.querySelector("link[rel*='icon']").href = DOM_CSS.iconBusy;
        }
    };

    const updateProgress = async () => {
        const elem = DOM_ELEMS.getClass(DOM_ELEMS.number)[0];
        const ratio = parseInt(document.getElementById(DOM_ELEMS.offset).value) / totalDuration * IN_PERCENTS;
        elem.innerHTML = `${Math.floor(ratio)}%`;
        elem.style.zIndex = 10;
        DOM_ELEMS.getClass(DOM_ELEMS.progress)[0].style.zIndex = 1;
        DOM_ELEMS.getClass(DOM_ELEMS.innerRing)[0].style.zIndex = 6;
    };

    const dropHandler = (ev) => {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        let file;
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (var i = 0; i < ev.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (ev.dataTransfer.items[i].kind === 'file') {
                    file = ev.dataTransfer.items[i].getAsFile();
                    break;
                }
            }
        } else {
            // Use DataTransfer interface to access the file(s)
            for (var i = 0; i < ev.dataTransfer.files.length; i++) {
                file = ev.dataTransferev.dataTransfer.files[i];
                break;
            }
        }
        FILES = {
            target: {
                files: [file]
            }
        };
        DOM_ELEMS.getId(DOM_ELEMS.uploader).files[0] = file;
        computeAll(FILES);
    };

    const dragOverHandler = (ev) => {
        ev.preventDefault();
    };

    const highlight = (e) => {
        DOM_ELEMS.getId(DOM_ELEMS.dropZone).classList.add(DOM_CSS.highlight);
    };

    const unhighlight = (e) => {
        DOM_ELEMS.getId(DOM_ELEMS.dropZone).classList.remove(DOM_CSS.highlight);
    };

    const updateContent = async () => {
        const elem = DOM_ELEMS.getClass(DOM_ELEMS.content)[0];
        elem.style.display = {
            'block': '',
            '': 'block'
        } [elem.style.display];
    };

    const updateThreshold = async (args) => {
        DOM_ELEMS.getClass(DOM_ELEMS.thresholdValue)[0].innerHTML = parseFloat(args.srcElement.value);
    };

    const convertTimestampToHMS = (timestamp) => {
        return new Date(timestamp * 1000).toISOString().substr(11, 8);
    };

    const updateTimestamps = async (modelPrediction, startOffset, threshold = 0.0) => {
        let condition;
        for (let i = 0, total = modelPrediction.length; i < total; i++) {
            if (timestamps.length)
                condition = (i - 1 + startOffset - timestamps[timestamps.length - 1]) > 2;
            else
                condition = true;
            if (modelPrediction[i] >= minThreshold && condition)
                preds.push([i - 1 + startOffset, modelPrediction[i]]);
            if (modelPrediction[i] >= threshold && condition)
                timestamps.push(i - 1 + startOffset);
        }
    };

    const addTimestamps = async () => {
        const timestamps_elem = DOM_ELEMS.getId(DOM_ELEMS.timestamps);
        timestamps_elem.innerHTML = '';
        DOM_ELEMS.getId(DOM_ELEMS.copy).style.display = 'inline';
        for (let i = 0, length = timestamps.length; i < length; i += 1) {
            timestamps_elem.innerHTML += `<div class="${DOM_CSS.group}"><a name=` + timestamps[i] +
                (backup.includes(timestamps[i]) ? ` class="${DOM_CSS.visited}">` : '>') +
                convertTimestampToHMS(timestamps[i]) + `</a><img class="${DOM_CSS.del}" src="${DOM_CSS.svgX}"/>\n</div>`;
        }
        Array.from(timestamps_elem.getElementsByClassName(DOM_CSS.del)).forEach(elem => {
            elem.addEventListener('click', deleteTimestamp);
        });
        Array.from(timestamps_elem.getElementsByTagName('A')).forEach(elem => {
            elem.addEventListener('click', updateAudio);
        });
    };

    const reloadTimestamps = async (args) => {
        const threshold = parseFloat(DOM_ELEMS.getId(DOM_ELEMS.threshold).value);
        timestamps.length = 0;
        let condition;
        for (let i = 0, total = preds.length; i < total; i++) {
            if (timestamps.length) {
                condition = (preds[i][0] - timestamps[timestamps.length - 1]) > 2;
            } else {
                condition = true;
            }
            if ((preds[i][1] >= threshold) && !(dump.includes(preds[i][0])) && condition) {
                timestamps.push(preds[i][0]);
            }
        };
        addTimestamps();
    };

    const expandTimestamps = async () => {
        const elem = DOM_ELEMS.getId(DOM_ELEMS.timestamps);
        const elem2 = DOM_ELEMS.getId(DOM_ELEMS.actions);
        const svg = DOM_ELEMS.getId(DOM_ELEMS.expand);
        let rot;
        if (elem.style.display === 'block') {
            elem.style.display = 'none';
            elem2.style.display = 'none';
            rot = 'rotate(0deg)';
        } else {
            elem.style.display = 'block';
            elem2.style.display = 'block';
            rot = 'rotate(180deg)';
        }
        svg.style.webkitTransform = rot;
        svg.style.mozTransform = rot;
        svg.style.msTransform = rot;
        svg.style.oTransform = rot;
        svg.style.transform = rot;
    };

    const deleteTimestamp = async (ev) => {
        if (!timestamps.length) {
            return;
        }
        offset = timestamps.indexOf(parseInt(ev.target.parentElement.getElementsByTagName('A')[0].name));
        dump.push(timestamps[offset]);
        DOM_ELEMS.getId(DOM_ELEMS.undo).style.display = 'inline';
        timestamps.splice(offset, 1);
        ev.target.parentElement.remove();
    };

    const getDuration = async () => {
        if (!FILES) {
            return;
        }
        const file = FILES.target.files[0];
        if (filesDurationMap[file.name]) {
            totalDuration = filesDurationMap[file.name];
            return;
        };
        const vid = document.createElement('video');
        const fileURL = URL.createObjectURL(FILES.target.files[0]);
        vid.addEventListener('durationchange', function logDurOnce() {
            filesDurationMap[file.name] = this.duration;
            totalDuration = this.duration;
            console.log(totalDuration);
            URL.revokeObjectURL(this.src);
            this.removeEventListener('durationchange', logDurOnce);
            this.remove();
        });
        vid.src = fileURL;
    };

    const testRun = async () => {
        let response = await fetch(TEST_FILE);
        let data = await response.blob();
        let metadata = {
            type: 'audio/mpeg'
        };
        let file = new File([data], TEST_FILE, metadata);
        FILES = {
            target: {
                files: [file]
            }
        };
        computeAll();
    };

    const changeCancel = async (args) => {
        iscancel ^= 1;
        Array.from(DOM_ELEMS.getClass(DOM_ELEMS.progress)).forEach(elem => {
            elem.style.background = iscancel ? COLOR_GREEN : COLOR_RED;
        });

    };

    const undoDelete = async () => {
        const restored = dump.pop();
        if (backup.includes(restored)) {
            backup.splice(backup.indexOf(restored), 1);
        }
        reloadTimestamps();
        if (!dump.length) {
            DOM_ELEMS.getId(DOM_ELEMS.undo).style.display = 'none';
        };
    };

    const copyClipboard = async () => {
        const el = DOM_ELEMS.getId(DOM_ELEMS.timestamps);
        const dummyTextarea = document.createElement('textarea');
        dummyTextarea.innerHTML = el.innerText || el.textContent;
        el.appendChild(dummyTextarea);
        dummyTextarea.select();
        dummyTextarea.setSelectionRange(0, 9999);
        document.execCommand('copy');
        el.removeChild(dummyTextarea);
    };

    [
        [DOM_ELEMS.next, 'click', updateAudio],
        [DOM_ELEMS.prev, 'click', updateAudio],
        [DOM_ELEMS.expand, 'click', expandTimestamps],
        [DOM_ELEMS.resetEnv, 'click', resetAudio],
        [DOM_ELEMS.uploader, 'change', computeAll],
        [DOM_ELEMS.compute, 'click', triggerNative],
        [DOM_ELEMS.process, 'click', computeAll],
        [DOM_ELEMS.loadModel, 'change', readModel],
        [DOM_ELEMS.threshold, 'change', reloadTimestamps],
        [DOM_ELEMS.threshold, 'input', updateThreshold],
        [DOM_ELEMS.undo, 'click', undoDelete],
        [DOM_ELEMS.copy, 'click', copyClipboard],
        [DOM_ELEMS.progressRing, 'click', changeCancel],
        [DOM_ELEMS.dropZone, 'drop', dropHandler],
        [DOM_ELEMS.dropZone, 'dragover', dragOverHandler],
        [DOM_ELEMS.settingsSvg, 'click', updateContent],
        [DOM_ELEMS.microphoneSvg, 'click', manageRecording],
        [DOM_ELEMS.demoBtn, 'click', loadDemo],
        [DOM_ELEMS.langRussian, 'click', changeInterface],
        [DOM_ELEMS.langEnglish, 'click', changeInterface],
    ].forEach(args => {
        DOM_ELEMS.getId(args[0]).addEventListener(args[1], args[2])
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        DOM_ELEMS.getId(DOM_ELEMS.dropZone).addEventListener(eventName, highlight, false)
    });
    ['dragleave', 'drop'].forEach(eventName => {
        DOM_ELEMS.getId(DOM_ELEMS.dropZone).addEventListener(eventName, unhighlight, false)
    });
    initScripts();
    INTERFACE.updateInterface();

})(this);
