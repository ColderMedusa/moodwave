document.addEventListener('DOMContentLoaded', function () {
  const STORAGE_KEYS = {
    favorites: 'or_favorites_v1',
    history: 'or_history_v1',
    lastStation: 'or_last_station_v1',
    lastVolume: 'or_last_volume_v1'
  };

  function normalizeLangCode(code) {
    if (!code) return 'en-GB';
    const cleaned = String(code).trim().replace('_', '-');
    const parts = cleaned.split('-');
    if (parts.length === 1) return parts[0].toLowerCase();
    return parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
  }

  function getDictionary(lang) {
    const dictAll = (typeof window.OR_I18N === 'object' && window.OR_I18N) ? window.OR_I18N : {};
    return dictAll[lang] || dictAll['en-GB'] || {
      play: 'Play',
      pause: 'Pause',
      next: 'Next station',
      volume: 'Volume',
      logoAlt: 'Radio station logo',
      sleepTimer: 'Sleep timer',
      remaining: 'Remaining',
      minutesShort: 'min',
      addToFavorites: 'Add to favorites',
      removeFromFavorites: 'Remove from favorites',
      live: 'Live',
      offline: 'Offline',
      favoritesEmpty: 'No favorite stations saved yet.',
      historyEmpty: 'No listening history yet.',
      stationsEmpty: 'No stations found.',
      searchEmpty: 'No matching stations found.',
      openStation: 'Open station page',
      previous: 'Previous',
      nextPage: 'Next',
      playStation: 'Play station',
      pauseStation: 'Pause station',
      searchPlaceholder: 'Search radio station',
      searchButtonLabel: 'Search'
    };
  }

  const pluginUrl = (typeof OR_PLUGIN !== 'undefined' && OR_PLUGIN.pluginUrl) ? OR_PLUGIN.pluginUrl : '';
  const imagesUrl = (typeof OR_PLUGIN !== 'undefined' && OR_PLUGIN.imagesUrl)
    ? OR_PLUGIN.imagesUrl
    : (pluginUrl ? (pluginUrl + '/assets/images/') : '');
  const siteBase = (typeof OR_PLUGIN !== 'undefined' && OR_PLUGIN.siteBase)
    ? String(OR_PLUGIN.siteBase)
    : (window.location.origin + '/');

  function normalizeSiteBase(url) {
    let u = String(url || '').trim();
    if (!u) return window.location.origin + '/';
    if (!u.endsWith('/')) u += '/';
    return u;
  }

  function normalizePageSlug(slug) {
    if (!slug) return '';
    let s = String(slug).trim();
    if (!s) return '';
    s = s.replace(/^\/+/, '');
    if (!s.endsWith('/')) s += '/';
    return s;
  }

  const normalizedSiteBase = normalizeSiteBase(siteBase);

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function getFavorites() {
    const data = readStorage(STORAGE_KEYS.favorites, []);
    return Array.isArray(data) ? data : [];
  }

  function setFavorites(ids) {
    writeStorage(STORAGE_KEYS.favorites, Array.isArray(ids) ? ids : []);
  }

  function isFavorite(id) {
    return getFavorites().includes(id);
  }

  function toggleFavorite(id) {
    const favorites = getFavorites();
    const idx = favorites.indexOf(id);
    if (idx === -1) {
      favorites.push(id);
    } else {
      favorites.splice(idx, 1);
    }
    setFavorites(favorites);
    return favorites.includes(id);
  }

  function getHistory() {
    const data = readStorage(STORAGE_KEYS.history, []);
    return Array.isArray(data) ? data : [];
  }

  function pushHistory(id) {
    let history = getHistory().filter(item => item !== id);
    history.unshift(id);
    history = history.slice(0, 10);
    writeStorage(STORAGE_KEYS.history, history);
  }

  function getLastStationId() {
    const data = readStorage(STORAGE_KEYS.lastStation, '');
    return typeof data === 'string' ? data : '';
  }

  function setLastStationId(id) {
    writeStorage(STORAGE_KEYS.lastStation, String(id || ''));
  }

  function getLastVolume() {
    const data = readStorage(STORAGE_KEYS.lastVolume, 1);
    const num = parseFloat(data);
    if (Number.isNaN(num)) return 1;
    return Math.min(1, Math.max(0, num));
  }

  function setLastVolume(value) {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    writeStorage(STORAGE_KEYS.lastVolume, Math.min(1, Math.max(0, num)));
  }

  function normalizeStationArray(rawStations) {
    const normalized = (Array.isArray(rawStations) ? rawStations : [])
      .filter(s => s && (s.stream_url || s.backup_stream) && (s.id || s.hashtag))
      .map(st => {
        const s = Object.assign({}, st);

        s.country = s.country ? String(s.country).trim().toUpperCase() : '';
        s.id = s.id ? String(s.id).trim() : '';
        s.hashtag = s.hashtag ? String(s.hashtag).trim() : '';
        if (!s.id && s.hashtag) s.id = s.hashtag;

        s.name = s.name || '';
        s.region = s.region || '';
        s.city = s.city || '';
        s.type = s.type || '';
        s.frequencies = Array.isArray(s.frequencies) ? s.frequencies : (s.frequencies ? [s.frequencies] : []);
        s.stream_url = s.stream_url ? String(s.stream_url).trim() : '';
        s.backup_stream = s.backup_stream ? String(s.backup_stream).trim() : '';
        s.logo = s.logo || '';
        s.logo_small = s.logo_small || '';
        s.page_slug = normalizePageSlug(s.page_slug || '');
        s.page_url = s.page_slug ? (normalizedSiteBase + s.page_slug) : '';
        s.metadata = !!s.metadata;
        s.metadata_url = s.metadata_url || '';
        s.bitrate = Number.isFinite(parseInt(s.bitrate, 10)) ? parseInt(s.bitrate, 10) : 0;
        s.codec = s.codec || '';
        s.popularity = Number.isFinite(parseInt(s.popularity, 10)) ? parseInt(s.popularity, 10) : 1;
        if (s.popularity < 1) s.popularity = 1;

        return s;
      });

    const seen = new Set();
    return normalized.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  function parseStationsFromAttribute(el) {
    if (!el) return [];
    try {
      return normalizeStationArray(JSON.parse(el.getAttribute('data-stations')) || []);
    } catch (e) {
      return [];
    }
  }

  const mainPlayerContainer = document.getElementById('online-radios-player');
  const playerStations = parseStationsFromAttribute(mainPlayerContainer);

  function normalizeSearchValue(value) {
    return String(value || '').toLowerCase().trim();
  }

  function getStationFieldValues(station, field) {
    if (!station || !field) return [];

    const value = station[field];

    if (Array.isArray(value)) {
      return value.map(v => String(v || ''));
    }

    if (value === undefined || value === null || value === false) {
      return [];
    }

    return [String(value)];
  }

  function getCommaTokenFieldValues(station, field) {
    const values = getStationFieldValues(station, field);
    const tokens = [];

    values.forEach(value => {
      String(value || '')
        .split(',')
        .map(v => normalizeSearchValue(v))
        .filter(Boolean)
        .forEach(v => tokens.push(v));
    });

    return tokens;
  }

  const audio = new Audio();
  audio.id = 'or-audio';
  audio.volume = getLastVolume();

  let currentStationId = null;
  let currentStation = null;
  let currentStationPool = [];
  let currentStatus = '';
  let recentRandomIds = [];
  let retryTimeoutId = null;
  let retryCount = 0;
  let usingBackup = false;
  const MAX_RETRIES = 4;
  const RETRY_DELAY = 3000;

  const subscribers = [];

  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
  }

  function notify() {
    subscribers.forEach(fn => {
      try { fn(); } catch (e) {}
    });
  }

  function rememberRecentRandom(id) {
    recentRandomIds = recentRandomIds.filter(item => item !== id);
    recentRandomIds.unshift(id);
    recentRandomIds = recentRandomIds.slice(0, 5);
  }

  function buildLogoUrl(station, logo) {
    const value = logo ? String(logo).trim() : '';
    if (!value) return '';

    if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;

    const cc = station && station.country
      ? String(station.country).trim().toUpperCase()
      : '';

    if (!cc) return '';

    return imagesUrl + encodeURIComponent(cc) + '/' + encodeURI(value);
  }

  function getLogoCandidates(station, preferSmall) {
    const fallbackRegular = imagesUrl + 'common/default-logo.webp';
    const fallbackSmall = imagesUrl + 'common/logo-small.webp';
    const fallback = preferSmall ? fallbackSmall : fallbackRegular;
    const candidates = [];

    if (station) {
      if (preferSmall) {
        const smallLogo = buildLogoUrl(station, station.logo_small);
        if (smallLogo) candidates.push(smallLogo);
      }

      const regularLogo = buildLogoUrl(station, station.logo);
      if (regularLogo && !candidates.includes(regularLogo)) {
        candidates.push(regularLogo);
      }
    }

    candidates.push(fallback);
    return candidates;
  }

  function setImageWithLogoFallback(image, station, preferSmall) {
    if (!image) return;

    const candidates = getLogoCandidates(station, preferSmall);
    let index = 0;

    image.onerror = function () {
      index += 1;
      if (index < candidates.length) {
        this.src = candidates[index];
      } else {
        this.onerror = null;
      }
    };

    image.src = candidates[index];
  }

  function resolveLogo(station, preferSmall) {
    return getLogoCandidates(station, preferSmall)[0];
  }

  function getCurrentPlayerStation() {
    return currentStation || null;
  }

  function isCurrentStationPlaying(stationId) {
    return currentStationId === stationId && !audio.paused;
  }

  function clearRetryTimer() {
    if (retryTimeoutId) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }
  }

  function resetRetryState() {
    retryCount = 0;
    usingBackup = false;
    clearRetryTimer();
  }

  function setSourceForStation(station) {
    if (!station) return;

    const primary = String(station.stream_url || '').trim();
    const backup = String(station.backup_stream || '').trim();

    audio.src = (usingBackup && backup) ? backup : (primary || backup);
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;

    const station = getCurrentPlayerStation();
    if (!station) return;

    const artistText = station.city
      ? station.city + (station.country ? ', ' + station.country : '')
      : (station.country || '');

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: station.name || '',
      artist: artistText,
      album: station.type || '',
      artwork: [
        {
          src: resolveLogo(station),
          sizes: '512x512',
          type: 'image/webp'
        }
      ]
    });

    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';

    try {
      navigator.mediaSession.setActionHandler('play', function () {
        playCurrent();
      });
      navigator.mediaSession.setActionHandler('pause', function () {
        pauseCurrent();
      });
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        nextStation();
      });
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    } catch (e) {}
  }

  function loadStationObject(station, stationPool) {
    if (!station || !station.id) return false;

    resetRetryState();
    currentStation = station;
    currentStationId = station.id;
    currentStationPool = Array.isArray(stationPool) && stationPool.length ? stationPool.slice() : playerStations.slice();
    currentStatus = '';
    setSourceForStation(station);
    setLastStationId(station.id);
    pushHistory(station.id);
    updateMediaSession();
    notify();
    return true;
  }

  function loadStationById(id) {
    const station = playerStations.find(s => s.id === id) || null;
    if (!station) return false;
    return loadStationObject(station, playerStations);
  }

  function loadStationFromListById(id, stationList) {
    const list = Array.isArray(stationList) ? stationList : [];
    const station = list.find(s => s.id === id) || null;
    if (!station) return false;
    return loadStationObject(station, list);
  }

  function loadStationByStationParam(value) {
    const v = String(value || '').trim();
    if (!v) return false;

    let station = playerStations.find(s => s.id === v) || null;
    if (!station) {
      station = playerStations.find(s => s.hashtag && s.hashtag === v) || null;
    }
    if (!station) return false;

    return loadStationById(station.id);
  }

  function playCurrent() {
    if (!currentStationId) return;
    audio.play().catch(function () {
      notify();
    });
  }

  function pauseCurrent() {
    audio.pause();
  }

  function playStationById(id) {
    if (currentStationId !== id) {
      loadStationById(id);
    }
    playCurrent();
  }

  function playStationFromListById(id, stationList) {
    if (currentStationId !== id) {
      loadStationFromListById(id, stationList);
    }
    playCurrent();
  }

  function toggleStationById(id) {
    if (currentStationId === id && !audio.paused) {
      pauseCurrent();
    } else {
      playStationById(id);
    }
  }

  function toggleStationFromListById(id, stationList) {
    if (currentStationId === id && !audio.paused) {
      pauseCurrent();
    } else {
      playStationFromListById(id, stationList);
    }
  }

  function pickNextRandomStation() {
    const excludeIds = currentStationId
      ? Array.from(new Set([currentStationId].concat(recentRandomIds)))
      : recentRandomIds.slice();

    const sourcePool = currentStationPool.length ? currentStationPool : playerStations;
    const pool = sourcePool.filter(s => !excludeIds.includes(s.id));
    const source = pool.length ? pool : sourcePool.slice();
    if (!source.length) return null;

    const totalWeight = source.reduce((sum, s) => sum + (s.popularity || 1), 0);
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < source.length; i++) {
      rand -= (source[i].popularity || 1);
      if (rand <= 0) return source[i];
    }

    return source[source.length - 1] || null;
  }

  function nextStation() {
    const next = pickNextRandomStation();
    if (!next) return;
    rememberRecentRandom(next.id);
    loadStationById(next.id);
    playCurrent();
  }

  function retryPlayback() {
    const station = getCurrentPlayerStation();
    if (!station) return;

    clearRetryTimer();

    const primary = String(station.stream_url || '').trim();
    const backup = String(station.backup_stream || '').trim();

    if (!primary && backup && !usingBackup) {
      usingBackup = true;
      retryCount = 0;
      setSourceForStation(station);
      retryTimeoutId = setTimeout(function () {
        audio.load();
        audio.play().catch(function () {});
      }, RETRY_DELAY);
      return;
    }

    if (retryCount < MAX_RETRIES) {
      retryCount += 1;
      retryTimeoutId = setTimeout(function () {
        audio.load();
        audio.play().catch(function () {});
      }, RETRY_DELAY);
      return;
    }

    if (!usingBackup && backup) {
      usingBackup = true;
      retryCount = 0;
      setSourceForStation(station);
      retryTimeoutId = setTimeout(function () {
        audio.load();
        audio.play().catch(function () {});
      }, RETRY_DELAY);
      return;
    }

    currentStatus = 'offline';
    notify();
  }

  audio.addEventListener('play', function () {
    retryCount = 0;
    clearRetryTimer();
    currentStatus = 'live';
    updateMediaSession();
    notify();
  });

  audio.addEventListener('pause', function () {
    updateMediaSession();
    notify();
  });

  audio.addEventListener('canplay', function () {
    currentStatus = 'live';
    notify();
  });

  audio.addEventListener('waiting', function () {
    notify();
  });

  audio.addEventListener('stalled', function () {
    notify();
  });

  audio.addEventListener('error', function () {
    currentStatus = 'offline';
    retryPlayback();
    notify();
  });

  function createStatusBadge(statusText, statusClass) {
    return `<span class="or-status ${statusClass}"><span class="or-status-dot" aria-hidden="true"></span>${statusText}</span>`;
  }

  function initMainPlayer() {
    const container = document.getElementById('online-radios-player');
    if (!container) return;
    if (!playerStations.length) return;

    const lang = normalizeLangCode(container.getAttribute('data-lang') || 'en-GB');
    const t = getDictionary(lang);
    const defaultStationParam = container.getAttribute('data-default-station') || '';
    const isCompactPlayer = container.getAttribute('data-compact') === '1';

    const logoEl = document.getElementById('or-logo');
    const nameEl = document.getElementById('or-station-name');
    const cityNameEl = document.getElementById('or-city-name');
    const statusLineEl = document.getElementById('or-status-line');
    const playBtn = document.getElementById('or-play-button');
    const forwardBtn = document.getElementById('or-forward-button');
    const volSlider = document.getElementById('or-volume-slider');
    const volumeLabel = document.getElementById('or-volume-label');
    const speakerIcon = document.getElementById('or-speaker-icon');
    const sleepLabel = document.getElementById('or-sleep-label');
    const sleepSelect = document.getElementById('or-sleep-select');
    const sleepRemaining = document.getElementById('or-sleep-remaining');
    const favoriteBtn = document.getElementById('or-favorite-button');

    if (playBtn) playBtn.setAttribute('aria-label', t.play);
    if (forwardBtn) forwardBtn.setAttribute('aria-label', t.next);
    if (favoriteBtn) favoriteBtn.setAttribute('aria-label', t.addToFavorites);
    if (volumeLabel) volumeLabel.textContent = t.volume;
    if (sleepLabel) sleepLabel.textContent = t.sleepTimer;
    if (logoEl) logoEl.alt = t.logoAlt;

    const defaultSpeakerPath = 'M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z';
    const muteSpeakerPath = 'M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z';

    function setSpeakerIcon(vol) {
      if (!speakerIcon) return;
      speakerIcon.innerHTML = (vol === 0)
        ? '<path stroke-linecap="round" stroke-linejoin="round" d="' + muteSpeakerPath + '"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" d="' + defaultSpeakerPath + '"/>';
    }

    function setPlayIcon(isPlaying) {
      if (!playBtn) return;
      playBtn.classList.remove('is-loading');
      playBtn.innerHTML = isPlaying
        ? '<svg class="or-pause-svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>'
        : '<svg class="or-play-svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
      playBtn.setAttribute('aria-label', isPlaying ? t.pause : t.play);
    }

    function setLoadingIcon() {
      if (!playBtn) return;
      playBtn.classList.add('is-loading');
      playBtn.innerHTML = '<span class="or-spinner" aria-hidden="true"></span>';
    }

    function updateFavoriteUI() {
      if (!favoriteBtn || !currentStationId) return;
      const active = isFavorite(currentStationId);
      favoriteBtn.classList.toggle('is-active', active);
      favoriteBtn.setAttribute('aria-label', active ? t.removeFromFavorites : t.addToFavorites);
    }

    function getPlaybackStatus() {
      return currentStatus;
    }

    function renderStatus() {
      if (!statusLineEl) return;

      const status = getPlaybackStatus();

      if (!status) {
        statusLineEl.innerHTML = '';
        return;
      }

      statusLineEl.innerHTML = status === 'live'
        ? createStatusBadge(t.live, 'or-status-live')
        : createStatusBadge(t.offline, 'or-status-offline');
    }

    function renderMainPlayer() {
      const station = getCurrentPlayerStation();
      if (!station) return;

      if (nameEl) nameEl.textContent = station.name || '';
      if (cityNameEl) cityNameEl.textContent = station.city || '';

      if (logoEl) {
        setImageWithLogoFallback(logoEl, station, isCompactPlayer);
        logoEl.alt = station.name ? station.name : t.logoAlt;
      }

      renderStatus();
      updateFavoriteUI();

      if (speakerIcon && volSlider) {
        setSpeakerIcon(parseFloat(volSlider.value || '1'));
      }

      if (playBtn) {
        if (!audio.paused && currentStationId === station.id) {
          setPlayIcon(true);
        } else {
          setPlayIcon(false);
        }
      }
    }

    if (volSlider) {
      volSlider.value = String(getLastVolume());
      audio.volume = getLastVolume();

      volSlider.addEventListener('input', function () {
        const vol = parseFloat(this.value);
        audio.volume = Number.isNaN(vol) ? 1 : vol;
        setLastVolume(audio.volume);
        setSpeakerIcon(audio.volume);
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (!currentStationId) return;
        if (audio.paused) {
          setLoadingIcon();
          playCurrent();
        } else {
          pauseCurrent();
        }
      });
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', function () {
        nextStation();
      });
    }

    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', function () {
        if (!currentStationId) return;
        toggleFavorite(currentStationId);
        updateFavoriteUI();
        notify();
      });
    }

    let sleepIntervalId = null;
    let sleepEndTs = null;

    function hideRemaining() {
      if (!sleepRemaining) return;
      sleepRemaining.textContent = '';
      sleepRemaining.style.display = 'none';
    }

    function showRemaining(text) {
      if (!sleepRemaining) return;
      sleepRemaining.textContent = text;
      sleepRemaining.style.display = 'inline-block';
    }

    function clearSleepTimer() {
      if (sleepIntervalId) {
        clearInterval(sleepIntervalId);
        sleepIntervalId = null;
      }
      sleepEndTs = null;
      hideRemaining();
    }

    function updateRemaining() {
      if (!sleepEndTs) return;
      const msLeft = sleepEndTs - Date.now();
      if (msLeft <= 0) {
        clearSleepTimer();
        pauseCurrent();
        if (sleepSelect) sleepSelect.value = '0';
        return;
      }
      const minsLeft = Math.ceil(msLeft / 60000);
      showRemaining(`${t.remaining}: ${minsLeft} ${t.minutesShort}`);
    }

    function startSleepTimer(minutes) {
      clearSleepTimer();
      if (!minutes || minutes <= 0) return;
      sleepEndTs = Date.now() + minutes * 60 * 1000;
      updateRemaining();
      sleepIntervalId = setInterval(updateRemaining, 1000);
    }

    if (sleepRemaining) hideRemaining();

    if (sleepSelect) {
      sleepSelect.addEventListener('change', function () {
        const minutes = parseInt(this.value, 10) || 0;
        if (minutes === 0) {
          clearSleepTimer();
          return;
        }
        startSleepTimer(minutes);
      });
    }

    subscribe(renderMainPlayer);

    const hashValue = window.location.hash.substring(1);
    let loaded = false;

    if (hashValue) loaded = loadStationByStationParam(hashValue);
    if (!loaded && defaultStationParam) loaded = loadStationByStationParam(defaultStationParam);

    if (!loaded) {
      const remembered = getLastStationId();
      if (remembered) loaded = loadStationById(remembered);
    }

    if (!loaded) {
      const random = pickNextRandomStation();
      if (random) {
        loaded = loadStationById(random.id);
        rememberRecentRandom(random.id);
      }
    }

    renderMainPlayer();
  }

  function getStationsForListingContainer(container) {
    return parseStationsFromAttribute(container);
  }

  function getStationByIdFromList(list, id) {
    return list.find(s => s.id === id) || null;
  }

  function buildStationCard(station, lang, linksEnabled) {
    const t = getDictionary(lang);
    const isPlaying = isCurrentStationPlaying(station.id);
    const playLabel = isPlaying ? t.pauseStation : t.playStation;
    const locationText = [station.city, station.country].filter(Boolean).join(', ');
    const canLink = !!linksEnabled && !!station.page_url;

    const wrapperTagOpen = canLink
      ? `<a class="or-station-card-link" href="${station.page_url}" aria-label="${t.openStation}">`
      : `<div class="or-station-card-link or-station-card-link-disabled">`;

    const wrapperTagClose = canLink ? '</a>' : '</div>';

    return `
      <div class="or-station-card" data-station-id="${station.id}">
        ${wrapperTagOpen}
          <div class="or-station-card-logo-wrap">
            <img class="or-station-card-logo" src="${resolveLogo(station, true)}" alt="${station.name || t.logoAlt}" data-logo-small="${buildLogoUrl(station, station.logo_small)}" data-logo-regular="${buildLogoUrl(station, station.logo)}">
          </div>
          <div class="or-station-card-content">
            <div class="or-station-card-name">${station.name || ''}</div>
            <div class="or-station-card-location">${locationText}</div>
          </div>
        ${wrapperTagClose}
        <button class="or-station-card-play" type="button" aria-label="${playLabel}" data-play-id="${station.id}">
          ${isPlaying
            ? '<svg class="or-station-card-play-icon" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>'
            : '<svg class="or-station-card-play-icon" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>'
          }
        </button>
      </div>
    `;
  }

  function renderListing(container, items, page, perPage, lang, emptyText) {
    const grid = container.querySelector('.or-station-listing-grid');
    const pagination = container.querySelector('.or-station-listing-pagination');
    const linksEnabled = container.getAttribute('data-links-enabled') === '1';

    if (!grid || !pagination) return;

    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * perPage;
    const pageItems = items.slice(start, start + perPage);

    if (!items.length) {
      grid.innerHTML = `<div class="or-station-listing-empty">${emptyText}</div>`;
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = pageItems.map(station => buildStationCard(station, lang, linksEnabled)).join('');

    grid.querySelectorAll('.or-station-card').forEach(function (card) {
      const stationId = card.getAttribute('data-station-id');
      const station = pageItems.find(item => String(item.id) === String(stationId));
      const image = card.querySelector('.or-station-card-logo');
      setImageWithLogoFallback(image, station, true);
    });

    pagination.innerHTML = '';

    if (totalPages > 1) {
      const t = getDictionary(lang);

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'or-pagination-button';
      prevBtn.textContent = t.previous;
      prevBtn.disabled = safePage === 1;
      prevBtn.addEventListener('click', function () {
        container.dataset.page = String(safePage - 1);
        rerenderSingleListing(container);
      });

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'or-pagination-button';
      nextBtn.textContent = t.nextPage;
      nextBtn.disabled = safePage === totalPages;
      nextBtn.addEventListener('click', function () {
        container.dataset.page = String(safePage + 1);
        rerenderSingleListing(container);
      });

      const pageInfo = document.createElement('span');
      pageInfo.className = 'or-pagination-info';
      pageInfo.textContent = `${safePage} / ${totalPages}`;

      pagination.appendChild(prevBtn);
      pagination.appendChild(pageInfo);
      pagination.appendChild(nextBtn);
    }

    grid.querySelectorAll('[data-play-id]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const id = this.getAttribute('data-play-id');
        const listingStations = getStationsForListingContainer(container);
        const station = getStationByIdFromList(listingStations, id);

        if (station) {
          toggleStationFromListById(id, listingStations);
        }
      });
    });
  }

  function filterStationsForContainer(container) {
    const allStations = getStationsForListingContainer(container);
    const source = container.getAttribute('data-source') || 'favorites';

    if (source === 'favorites') {
      return getFavorites()
        .map(id => getStationByIdFromList(allStations, id))
        .filter(Boolean);
    }

    if (source === 'history') {
      return getHistory()
        .map(id => getStationByIdFromList(allStations, id))
        .filter(Boolean);
    }

    if (source === 'search') {
      const allow = String(container.getAttribute('data-allow') || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

      const query = container.dataset.searchQuery || '';
      const q = normalizeSearchValue(query);
      if (!q) return [];

      return allStations.filter(station => {
        return allow.some(field => {
          const values = getStationFieldValues(station, field);
          return values.some(value => normalizeSearchValue(value).includes(q));
        });
      });
    }

    if (source === 'stations') {
      let filters = {};
      try {
        filters = JSON.parse(container.getAttribute('data-filters') || '{}');
      } catch (e) {
        filters = {};
      }

      let result = allStations.slice();

      if (Array.isArray(filters.ids) && filters.ids.length) {
        const wantedIds = filters.ids.map(String);
        result = result.filter(station => wantedIds.includes(String(station.id || '')));
      }

      const exactFields = ['name', 'region', 'city', 'codec'];

      exactFields.forEach(field => {
        const values = Array.isArray(filters[field]) ? filters[field].map(normalizeSearchValue) : [];
        if (!values.length) return;

        result = result.filter(station => {
          const stationValues = getStationFieldValues(station, field).map(normalizeSearchValue);
          return stationValues.some(v => values.includes(v));
        });
      });

      if (Array.isArray(filters.type) && filters.type.length) {
        const wantedTypes = filters.type.map(normalizeSearchValue).filter(Boolean);

        result = result.filter(station => {
          const stationTypes = getCommaTokenFieldValues(station, 'type');
          return stationTypes.some(v => wantedTypes.includes(v));
        });
      }

      if (filters.field && Array.isArray(filters.values) && filters.values.length) {
        const fieldName = String(filters.field).trim();
        const wanted = filters.values.map(normalizeSearchValue).filter(Boolean);

        result = result.filter(station => {
          const stationValues = fieldName === 'type'
            ? getCommaTokenFieldValues(station, fieldName)
            : getStationFieldValues(station, fieldName).map(normalizeSearchValue);

          return stationValues.some(v => wanted.includes(v));
        });
      }

      if (filters.limit && Number(filters.limit) > 0) {
        result = result.slice(0, Number(filters.limit));
      }

      return result;
    }

    return allStations;
  }

  function rerenderSingleListing(container) {
    const source = container.getAttribute('data-source') || 'favorites';
    const lang = normalizeLangCode(container.getAttribute('data-lang') || 'en-GB');
    const perPage = Math.max(1, parseInt(container.getAttribute('data-per-page') || '20', 10));
    const page = Math.max(1, parseInt(container.dataset.page || '1', 10));
    const t = getDictionary(lang);

    if (source === 'search') {
      const query = container.dataset.searchQuery || '';
      if (!query.trim()) {
        const grid = container.querySelector('.or-station-listing-grid');
        const pagination = container.querySelector('.or-station-listing-pagination');
        if (grid) grid.innerHTML = '';
        if (pagination) pagination.innerHTML = '';
        return;
      }
    }

    const items = filterStationsForContainer(container);

    if (source === 'favorites') {
      renderListing(container, items, page, perPage, lang, t.favoritesEmpty);
      return;
    }

    if (source === 'history') {
      renderListing(container, items, page, perPage, lang, t.historyEmpty);
      return;
    }

    if (source === 'search') {
      renderListing(container, items, page, perPage, lang, t.searchEmpty);
      return;
    }

    if (source === 'stations') {
      renderListing(container, items, page, perPage, lang, t.stationsEmpty);
    }
  }

  function initStationListings() {
    const listings = document.querySelectorAll('.or-station-listing');
    if (!listings.length) return;

    listings.forEach(container => {
      container.dataset.page = '1';

      const source = container.getAttribute('data-source') || '';
      const lang = normalizeLangCode(container.getAttribute('data-lang') || 'en-GB');
      const t = getDictionary(lang);

      if (source === 'search') {
        const input = container.querySelector('.or-search-input');
        const submitBtn = container.querySelector('.or-search-submit');
        const grid = container.querySelector('.or-station-listing-grid');
        const pagination = container.querySelector('.or-station-listing-pagination');

        if (grid) grid.innerHTML = '';
        if (pagination) pagination.innerHTML = '';

        if (input) {
          input.placeholder = t.searchPlaceholder;
          input.setAttribute('aria-label', t.searchPlaceholder);

          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              container.dataset.searchQuery = input.value || '';
              container.dataset.page = '1';
              rerenderSingleListing(container);
            }
          });
        }

        if (submitBtn) {
          submitBtn.setAttribute('aria-label', t.searchButtonLabel || t.searchPlaceholder);
          submitBtn.addEventListener('click', function () {
            container.dataset.searchQuery = input ? (input.value || '') : '';
            container.dataset.page = '1';
            rerenderSingleListing(container);
          });
        }
      } else {
        rerenderSingleListing(container);
      }

      subscribe(function () {
        if (source !== 'search') {
          rerenderSingleListing(container);
        }
      });
    });
  }


  function escapeFieldHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function mappingFor(kind) {
    if (typeof OR_PLUGIN !== 'object' || !OR_PLUGIN) return {};
    return kind === 'region' ? (OR_PLUGIN.regionMappings || {}) : (OR_PLUGIN.genreMappings || {});
  }

  function renderMappedField(value, kind, linksMode, separator) {
    const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
    const map = mappingFor(kind);
    const globalEnabled = kind === 'region' ? !!OR_PLUGIN.regionLinks : !!OR_PLUGIN.genreLinks;
    return rawValues.map(raw => String(raw || '').trim()).filter(Boolean).map(raw => {
      const entry = map[String(raw).toLowerCase()] || {};
      const label = entry.label || raw;
      let url = entry.url || '';
      const entryLinkMode = Object.prototype.hasOwnProperty.call(entry, 'link') ? entry.link : null;
      const entryLinksEnabled = linksMode === 'no'
        ? false
        : (linksMode === 'yes' ? true : (entryLinkMode === null ? globalEnabled : !!entryLinkMode));
      if (url && url.startsWith('/') && !url.startsWith('//')) url = normalizedSiteBase.replace(/\/$/, '') + url;
      if (entryLinksEnabled && url) return '<a class="or-field-link or-' + kind + '-link" href="' + escapeFieldHtml(url) + '">' + escapeFieldHtml(label) + '</a>';
      return '<span class="or-field-value or-' + kind + '-value">' + escapeFieldHtml(label) + '</span>';
    }).join(escapeFieldHtml(separator || ', '));
  }

  function updateDynamicFields() {
    const station = getCurrentPlayerStation();
    document.querySelectorAll('.or-dynamic-field').forEach(el => {
      const field = el.dataset.orField || '';
      const fallback = el.dataset.orDefault || '';
      const format = el.dataset.orFormat || 'plain';
      const links = el.dataset.orLinks || 'default';
      const separator = el.dataset.orSeparator || ', ';
      if (!station || !field || station[field] === undefined || station[field] === null || station[field] === '') {
        el.textContent = fallback;
        return;
      }
      const value = station[field];
      if (format === 'mapped' && field === 'type') el.innerHTML = renderMappedField(value, 'genre', links, separator);
      else if (format === 'mapped' && field === 'region') el.innerHTML = renderMappedField(value, 'region', links, separator);
      else el.textContent = Array.isArray(value) ? value.join(separator) : (typeof value === 'boolean' ? String(value) : String(value));
    });
  }

  subscribe(updateDynamicFields);

  initMainPlayer();
  initStationListings();
  updateDynamicFields();

  window.ORPlayer = window.ORPlayer || {};
  window.ORPlayer.audio = audio;

  window.ORPlayer.api = {
    getPlayerStations: function () { return playerStations.slice(); },
    getCurrentStation: function () { return getCurrentPlayerStation(); },
    playStationById: function (id) { playStationById(id); },
    pause: function () { pauseCurrent(); },
    play: function () { playCurrent(); },
    toggleStationById: function (id) { toggleStationById(id); },
    loadStationObject: function (station, stationPool) { return loadStationObject(station, stationPool); },
    nextStation: function () { nextStation(); },
    subscribe: function (fn) { subscribe(fn); }
  };

  window.ORPlayer.loadStationById = loadStationById;
  window.ORPlayer.loadStationByStationParam = loadStationByStationParam;
  window.ORPlayer.playStationById = playStationById;
  window.ORPlayer.toggleStationById = toggleStationById;
  window.ORPlayer.loadStationObject = loadStationObject;
  window.ORPlayer.toggleStationFromListById = toggleStationFromListById;
  window.ORPlayer.nextStation = nextStation;
  window.ORPlayer.getFavorites = getFavorites;
  window.ORPlayer.getHistory = getHistory;
});
