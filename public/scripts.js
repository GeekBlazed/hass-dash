(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let suppressRoomClick = false;

  const HOTWIRE_LIGHT_ENTITY_IDS = new Set(['light.norad_corner_torch']);

  const INIT_MARKER_ATTR = 'data-hassdash-prototype-init';
  const BOUND_MARKER_ATTR = 'data-hassdash-prototype-bound';

  function dispatchLightToggle(entityId) {
    if (!HOTWIRE_LIGHT_ENTITY_IDS.has(String(entityId || ''))) return;

    window.dispatchEvent(
      new CustomEvent('hass-dash:toggle-light', {
        detail: { entityId: String(entityId) },
      })
    );
  }

  function stripComments(line) {
    const idx = line.indexOf('#');
    if (idx === -1) return line;
    return line.slice(0, idx);
  }

  function unquote(value) {
    const v = value.trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function coerceScalar(value) {
    const raw = unquote(value);
    if (raw === '') return '';
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const n = Number(raw);
    if (!Number.isNaN(n) && String(n) === raw.replace(/\.0+$/, '').replace(/\.$/, '')) return n;
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(raw)) return n;
    return raw;
  }

  function parseInlineArray(text) {
    const t = text.trim();
    if (!t.startsWith('[') || !t.endsWith(']')) return null;
    const jsonish = t.replace(/'([^']*)'/g, '"$1"');
    try {
      return JSON.parse(jsonish);
    } catch {
      return null;
    }
  }

  function parseYamlLite(yamlText) {
    const lines = yamlText
      .split(/\r?\n/)
      .map((l) => stripComments(l))
      .map((l) => l.replace(/\t/g, '    '));

    function nextNonEmpty(startIdx) {
      let i = startIdx;
      while (i < lines.length) {
        if (lines[i].trim() !== '') return i;
        i++;
      }
      return i;
    }

    function indentOf(line) {
      const m = line.match(/^\s*/);
      return m ? m[0].length : 0;
    }

    function parseBlock(startIdx, baseIndent) {
      let idx = nextNonEmpty(startIdx);
      if (idx >= lines.length) return [{}, idx];

      const isSeq = lines[idx].trimStart().startsWith('- ');
      if (isSeq) {
        const arr = [];
        while (idx < lines.length) {
          idx = nextNonEmpty(idx);
          if (idx >= lines.length) break;
          const line = lines[idx];
          const ind = indentOf(line);
          if (ind < baseIndent) break;
          if (ind !== baseIndent || !line.trimStart().startsWith('- ')) break;

          const afterDash = line.trimStart().slice(2);
          if (afterDash.includes(':')) {
            const colon = afterDash.indexOf(':');
            const k = afterDash.slice(0, colon).trim();
            const rest = afterDash.slice(colon + 1).trim();
            const obj = {};
            if (rest === '') {
              const [nested, nextIdx] = parseBlock(idx + 1, baseIndent + 2);
              obj[k] = nested;
              arr.push(obj);
              idx = nextIdx;
              continue;
            }
            const inlineArr = parseInlineArray(rest);
            obj[k] = inlineArr !== null ? inlineArr : coerceScalar(rest);
            idx++;
            const nextIdx = nextNonEmpty(idx);
            if (nextIdx < lines.length && indentOf(lines[nextIdx]) > baseIndent) {
              const [more, doneIdx] = parseBlock(idx, baseIndent + 2);
              if (more && typeof more === 'object' && !Array.isArray(more)) {
                Object.assign(obj, more);
              }
              idx = doneIdx;
            }
            arr.push(obj);
            continue;
          }

          const inlineArr = parseInlineArray(afterDash);
          if (inlineArr !== null) {
            arr.push(inlineArr);
            idx++;
            continue;
          }
          if (afterDash.trim() === '') {
            const [nested, nextIdx] = parseBlock(idx + 1, baseIndent + 2);
            arr.push(nested);
            idx = nextIdx;
            continue;
          }
          arr.push(coerceScalar(afterDash));
          idx++;
        }
        return [arr, idx];
      }

      const obj = {};
      while (idx < lines.length) {
        idx = nextNonEmpty(idx);
        if (idx >= lines.length) break;
        const line = lines[idx];
        const ind = indentOf(line);
        if (ind < baseIndent) break;
        if (ind !== baseIndent) break;
        const trimmed = line.trim();
        const colon = trimmed.indexOf(':');
        if (colon === -1) {
          idx++;
          continue;
        }
        const key = trimmed.slice(0, colon).trim();
        const rest = trimmed.slice(colon + 1).trim();
        if (rest === '') {
          const [nested, nextIdx] = parseBlock(idx + 1, baseIndent + 2);
          obj[key] = nested;
          idx = nextIdx;
          continue;
        }
        const inlineArr = parseInlineArray(rest);
        obj[key] = inlineArr !== null ? inlineArr : coerceScalar(rest);
        idx++;
      }
      return [obj, idx];
    }

    const [doc] = parseBlock(0, 0);
    return doc;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function centroid(points) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of points) {
      sx += x;
      sy += y;
    }
    return [sx / points.length, sy / points.length];
  }

  function computeBounds(rooms) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const room of rooms) {
      for (const [x, y] of room.points) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    return { minX, minY, maxX, maxY };
  }

  function renderFloorplan(doc, devicesDoc, climateDoc, lightingModel) {
    const svg = document.getElementById('floorplan-svg');
    const wallsLayer = document.getElementById('walls-layer');
    const labelsLayer = document.getElementById('labels-layer');
    const lightsLayer = document.getElementById('lights-layer');
    const nodesLayer = document.getElementById('nodes-layer');
    const devicesLayer = document.getElementById('devices-layer');
    if (!svg || !(wallsLayer instanceof SVGGElement) || !(labelsLayer instanceof SVGGElement)) {
      return;
    }

    const floors = Array.isArray(doc?.floors) ? doc.floors : [];

    const thermostatDefaults =
      climateDoc?.thermostat && typeof climateDoc.thermostat === 'object'
        ? climateDoc.thermostat.default
        : null;
    const climateUnit =
      thermostatDefaults && typeof thermostatDefaults.unit === 'string'
        ? String(thermostatDefaults.unit).trim()
        : '°F';
    const climatePrecisionRaw = thermostatDefaults ? Number(thermostatDefaults.precision) : 0;
    const climatePrecision = Number.isFinite(climatePrecisionRaw)
      ? Math.max(0, Math.min(3, climatePrecisionRaw))
      : 0;
    const formatTemp = (t) => {
      if (!Number.isFinite(t)) return '';
      const v = Number(t);
      return `${v.toFixed(climatePrecision)}${climateUnit}`;
    };

    const climateAreas = Array.isArray(climateDoc?.areas) ? climateDoc.areas : [];
    const climateByRoomId = new Map();
    for (const area of climateAreas) {
      if (!area || typeof area !== 'object') continue;
      const areaId = String(area.area_id || '').trim();
      if (!areaId) continue;

      const temp = Number(area.temp);
      const humidityRaw = area.humidity;
      const humidity =
        humidityRaw === null || humidityRaw === undefined ? NaN : Number(humidityRaw);

      climateByRoomId.set(areaId, {
        temp: Number.isFinite(temp) ? temp : null,
        humidity: Number.isFinite(humidity) ? humidity : null,
      });
    }

    // Floor selection
    // Priority:
    // 1) Root-level `default_floor_id` string
    // 2) Legacy fallback: floor id == 'ground'
    // 3) First floor
    const preferredFloorId =
      typeof doc?.default_floor_id === 'string' ? String(doc.default_floor_id).trim() : '';

    const floorById = preferredFloorId
      ? floors.find((f) => String(f?.id || '').trim() === preferredFloorId)
      : null;

    const floor = floorById || floors.find((f) => f?.id === 'ground') || floors[0];
    const floorInitialView = {
      scale: Number(floor?.initial_scale),
      x: Number(floor?.initial_x),
      y: Number(floor?.initial_y),
    };
    const rooms = Array.isArray(floor?.rooms) ? floor.rooms : [];
    const nodes = Array.isArray(floor?.nodes)
      ? floor.nodes
      : Array.isArray(doc?.nodes)
        ? doc.nodes
        : [];
    const floorBounds = Array.isArray(floor?.bounds) ? floor.bounds : null;
    const roomsNormalized = rooms
      .filter((r) => r && Array.isArray(r.points))
      .map((r) => ({
        id: String(r.id || r.name || '').trim(),
        name: String(r.name || r.id || '').trim(),
        points: r.points.map((p) => [Number(p[0]), Number(p[1])]),
      }))
      .filter((r) => r.id && r.points.length >= 3);

    const nodesNormalized = nodes
      .filter((n) => n)
      .map((n) => {
        const point = Array.isArray(n.point) ? n.point : Array.isArray(n.points) ? n.points : null;
        const x = point ? Number(point[0]) : Number(n.x);
        const y = point ? Number(point[1]) : Number(n.y);
        return {
          id: String(n.id || n.name || '').trim(),
          name: String(n.name || n.id || '').trim(),
          x,
          y,
        };
      })
      .filter((n) => n.id && n.name && Number.isFinite(n.x) && Number.isFinite(n.y));

    const boundsFromFloor =
      floorBounds &&
      floorBounds.length >= 2 &&
      Array.isArray(floorBounds[0]) &&
      Array.isArray(floorBounds[1])
        ? {
            minX: Number(floorBounds[0][0]),
            minY: Number(floorBounds[0][1]),
            maxX: Number(floorBounds[1][0]),
            maxY: Number(floorBounds[1][1]),
          }
        : null;

    const { minX, minY, maxX, maxY } = boundsFromFloor || computeBounds(roomsNormalized);
    const pad = 1.25;
    const vbX = minX - pad;
    const vbY = minY - pad;
    const vbW = maxX - minX + pad * 2;
    const vbH = maxY - minY + pad * 2;
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    // Persist the base viewBox used for coordinate transforms. Pan/zoom mutates the
    // live viewBox, but our Y-flip should remain stable within the original space.
    svg.setAttribute('data-base-viewbox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    // YAML coordinates treat positive Y as north/up.
    // SVG increases Y downward, so we flip within the computed viewBox.
    const flipY = (y) => 2 * vbY + vbH - y;
    const roomsForRender = roomsNormalized.map((room) => ({
      ...room,
      points: room.points.map(([x, y]) => [x, flipY(y)]),
    }));

    const nodesForRender = nodesNormalized.map((node) => ({
      ...node,
      y: flipY(node.y),
    }));

    const originGps = doc?.gps && typeof doc.gps === 'object' ? doc.gps : null;
    const devices = Array.isArray(devicesDoc?.devices) ? devicesDoc.devices : [];

    // Devices can be defined with GPS (for the original prototype), or without GPS
    // when Home Assistant provides live x/y tracking. When GPS is missing, we still
    // render the marker (to preserve label/color) but place it off-canvas until a
    // live update moves it.
    const offCanvasX = vbX - vbW * 5;
    const offCanvasY = vbY - vbH * 5;

    const devicesNormalized = devices
      .filter((d) => d)
      .map((d) => {
        const id = String(d.id || d.label || '').trim();
        const label = String(d.label || d.id || '').trim();
        const color = String(d.color || '').trim();
        if (!id || !label) return null;

        const fallbackGps = [
          d.latitude ?? d.lat ?? d.lattitude,
          d.longitude ?? d.lon ?? d.lng ?? d.longtitude,
          d.elevation ?? d.altitude ?? d.alt,
        ];
        const deviceGps = Array.isArray(d.gps) ? d.gps : fallbackGps;
        const local = gpsToLocalMeters(deviceGps, originGps);

        if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) {
          return {
            id,
            label,
            color,
            x: local.x,
            y: local.y,
            z: local.z,
          };
        }

        return {
          id,
          label,
          color,
          x: offCanvasX,
          y: offCanvasY,
          z: 0,
        };
      })
      .filter((d) => d && d.id && d.label && Number.isFinite(d.x) && Number.isFinite(d.y));

    const devicesForRender = devicesNormalized.map((d) => ({
      ...d,
      y: flipY(d.y),
    }));

    while (wallsLayer.firstChild) wallsLayer.removeChild(wallsLayer.firstChild);
    while (labelsLayer.firstChild) labelsLayer.removeChild(labelsLayer.firstChild);
    if (nodesLayer instanceof SVGGElement) {
      while (nodesLayer.firstChild) nodesLayer.removeChild(nodesLayer.firstChild);
    }
    if (lightsLayer instanceof SVGGElement) {
      while (lightsLayer.firstChild) lightsLayer.removeChild(lightsLayer.firstChild);
    }
    if (devicesLayer instanceof SVGGElement) {
      while (devicesLayer.firstChild) devicesLayer.removeChild(devicesLayer.firstChild);
    }

    let activeId = null;

    function setActive(id) {
      activeId = id;
      for (const g of wallsLayer.querySelectorAll('.room')) {
        g.classList.toggle('is-active', g.getAttribute('data-room-id') === id);
      }
      for (const g of labelsLayer.querySelectorAll('.room-label-group')) {
        g.classList.toggle('is-active', g.getAttribute('data-room-id') === id);
      }
    }

    for (const room of roomsForRender) {
      const g = svgEl('g', {
        class: 'room',
        'data-room-id': room.id,
        tabindex: '0',
        role: 'button',
        'aria-label': room.name,
      });

      const pts = room.points.map(([x, y]) => `${x},${y}`).join(' ');
      const poly = svgEl('polygon', { points: pts, class: 'room-shape' });
      g.appendChild(poly);

      const labelGroup = svgEl('g', {
        class: 'room-label-group',
        'data-room-id': room.id,
      });

      const [cx, cy] = centroid(room.points);
      const label = svgEl('text', {
        x: cx,
        y: cy,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'room-label',
      });
      label.textContent = room.name;
      labelGroup.appendChild(label);

      const climate = climateByRoomId.get(room.id);
      const climateParts = [];
      if (climate && Number.isFinite(climate.temp)) {
        climateParts.push(formatTemp(climate.temp));
      }
      if (climate && Number.isFinite(climate.humidity)) {
        climateParts.push(`${Math.round(climate.humidity)}%`);
      }
      const climateText = climateParts.join(' • ');
      if (climateText) {
        const climateEl = svgEl('text', {
          x: cx,
          y: cy,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          dy: '1.45em',
          class: 'room-climate is-hidden',
          'data-room-id': room.id,
        });
        climateEl.textContent = climateText;
        labelGroup.appendChild(climateEl);
      }

      g.addEventListener('click', (e) => {
        e.preventDefault();
        if (suppressRoomClick) {
          suppressRoomClick = false;
          return;
        }
        setActive(room.id);
        // Some browsers don't reliably move focus to SVG elements on click.
        // Keep focus on the selected room for keyboard continuity.
        g.focus({ preventScroll: true });
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActive(room.id);
        }
      });

      g.addEventListener('mouseenter', () => {
        if (activeId === room.id) return;
        labelGroup.classList.add('is-hover');
      });
      g.addEventListener('mouseleave', () => {
        labelGroup.classList.remove('is-hover');
      });
      g.addEventListener('focus', () => {
        if (activeId === room.id) return;
        labelGroup.classList.add('is-focus');
      });
      g.addEventListener('blur', () => {
        labelGroup.classList.remove('is-focus');
      });

      wallsLayer.appendChild(g);
      labelsLayer.appendChild(labelGroup);

      // Lighting toggle buttons live on a dedicated overlay layer.
      if (lightsLayer instanceof SVGGElement && lightingModel?.byRoomId instanceof Map) {
        const roomLights = lightingModel.byRoomId.get(room.id);
        if (Array.isArray(roomLights) && roomLights.length) {
          const [cx, cy] = centroid(room.points);

          const toggle = svgEl('g', {
            class: 'light-toggle',
            'data-room-id': room.id,
            'data-cx': cx,
            'data-cy': cy,
            tabindex: '0',
            role: 'button',
            'aria-label': `Toggle lights: ${room.name}`,
          });

          const bg = svgEl('rect', {
            class: 'light-toggle-bg',
            x: -0.6,
            y: -0.45,
            width: 1.2,
            height: 0.9,
            rx: 0.25,
            ry: 0.25,
          });
          toggle.appendChild(bg);

          const icon = svgEl('use', {
            class: 'light-toggle-icon',
            href: '#lightBulb',
            'xlink:href': '#lightBulb',
            x: -0.25,
            y: -0.25,
            width: 0.5,
            height: 0.5,
          });
          toggle.appendChild(icon);

          const computeRoomOn = () =>
            roomLights.some((l) => String(l.state || '').toLowerCase() === 'on');

          const applyToggleState = () => {
            toggle.classList.toggle('is-on', computeRoomOn());
          };

          const toggleRoomLights = () => {
            const currentlyOn = computeRoomOn();
            const next = currentlyOn ? 'off' : 'on';
            for (const l of roomLights) {
              l.state = next;
              dispatchLightToggle(l.id);
            }
            applyToggleState();
            applyLightingPanel(lightingModel);
          };

          toggle.addEventListener('click', (e) => {
            e.preventDefault();
            suppressRoomClick = true;
            toggleRoomLights();
            toggle.focus({ preventScroll: true });
          });
          toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              suppressRoomClick = true;
              toggleRoomLights();
            }
          });

          applyToggleState();
          lightsLayer.appendChild(toggle);
        }
      }
    }

    if (nodesLayer instanceof SVGGElement) {
      for (const node of nodesForRender) {
        const dot = svgEl('circle', {
          class: 'node-dot',
          cx: node.x,
          cy: node.y,
          r: 0.12,
          'data-node-id': node.id,
        });
        nodesLayer.appendChild(dot);

        const label = svgEl('text', {
          class: 'node-label',
          x: node.x,
          y: node.y,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          dy: '-0.9em',
          'data-node-id': node.id,
        });
        label.textContent = node.name;
        nodesLayer.appendChild(label);
      }
    }

    if (devicesLayer instanceof SVGGElement) {
      for (const device of devicesForRender) {
        const g = svgEl('g', {
          class: 'device-marker',
          transform: `translate(${device.x} ${device.y})`,
          'data-device-id': device.id,
          style: device.color ? `color: ${device.color};` : '',
          'aria-label': device.label,
        });

        const use = svgEl('use', {
          class: 'device-pin',
          href: '#devicePin',
          'xlink:href': '#devicePin',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        });
        g.appendChild(use);

        const label = svgEl('text', {
          class: 'device-label',
          x: 0,
          y: 0,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'data-device-id': device.id,
        });
        label.textContent = device.label;
        g.appendChild(label);

        devicesLayer.appendChild(g);
      }
    }

    if (roomsForRender.length) setActive(roomsForRender[0].id);

    return {
      floorId: String(floor?.id || ''),
      roomsCount: roomsForRender.length,
      devicesCount: devicesForRender.length,
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      baseViewBox: { x: vbX, y: vbY, w: vbW, h: vbH },
      initialView: {
        scale: Number.isFinite(floorInitialView.scale) ? floorInitialView.scale : null,
        x: Number.isFinite(floorInitialView.x) ? floorInitialView.x : null,
        y: Number.isFinite(floorInitialView.y) ? floorInitialView.y : null,
      },
    };
  }

  function enablePanZoom(baseViewBox, initialView) {
    const svg = document.getElementById('floorplan-svg');
    if (!(svg instanceof SVGSVGElement) || !baseViewBox) return;

    const controls = document.getElementById('map-controls');
    const controlsClose = document.getElementById('map-controls-close');
    const controlsToggle = document.getElementById('map-controls-toggle');

    const setControlsVisible = (visible) => {
      if (controls instanceof HTMLElement) {
        controls.classList.toggle('is-hidden', !visible);
      }
      if (controlsToggle instanceof HTMLElement) {
        controlsToggle.classList.toggle('is-hidden', visible);
        controlsToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
      }
    };

    if (controlsClose instanceof HTMLButtonElement) {
      controlsClose.addEventListener('click', () => setControlsVisible(false));
    }
    if (controlsToggle instanceof HTMLButtonElement) {
      controlsToggle.addEventListener('click', () => setControlsVisible(true));
    }

    // Default: controls visible, toggle hidden.
    setControlsVisible(false);

    const zoomSlider = document.getElementById('map-zoom');
    const zoomValue = document.getElementById('map-zoom-value');
    const launchScaleValue = document.getElementById('map-launch-scale');
    const launchPercentValue = document.getElementById('map-launch-percent');
    const launchXValue = document.getElementById('map-launch-x');
    const launchYValue = document.getElementById('map-launch-y');
    const panUp = document.getElementById('map-pan-up');
    const panDown = document.getElementById('map-pan-down');
    const panLeft = document.getElementById('map-pan-left');
    const panRight = document.getElementById('map-pan-right');

    const minScale = 0.5;
    const maxScale = 3.0;

    let current = { ...baseViewBox };
    let scale = 1.0;

    const pointers = new Map();
    let mouseDragging = false;
    let dragStart = null;
    let dragMoved = false;
    let gestureStart = null;

    // Increase/decrease device marker size (in screen pixels) without affecting map scale.
    // Markers were bumped ~50% larger to better fit avatar/initials overlays.
    const DEVICE_PIN_SCALE = 3.15;

    const updateRoomLabelSizes = (desiredPx = 14) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const vb = readViewBox();
      const unitsPerPx = vb.w / rect.width;
      const roomFontSizeInUserUnits = desiredPx * unitsPerPx;
      const roomClimateFontSizeInUserUnits = (desiredPx - 3) * unitsPerPx;
      const nodeFontSizeInUserUnits = 11 * unitsPerPx;
      const nodeRadiusInUserUnits = 4 * unitsPerPx;
      const deviceLabelFontSizeInUserUnits = 11 * unitsPerPx;
      const devicePinHeightInUserUnits = 34 * DEVICE_PIN_SCALE * unitsPerPx;
      const devicePinWidthInUserUnits = 26 * DEVICE_PIN_SCALE * unitsPerPx;
      const deviceLabelGapInUserUnits = 6 * DEVICE_PIN_SCALE * unitsPerPx;

      const roomLabels = svg.querySelectorAll('.room-label');
      for (const label of roomLabels) {
        if (label instanceof SVGTextElement) {
          label.setAttribute('font-size', String(roomFontSizeInUserUnits));
        }
      }

      const roomClimateLabels = svg.querySelectorAll('.room-climate');
      for (const label of roomClimateLabels) {
        if (label instanceof SVGTextElement) {
          label.setAttribute('font-size', String(roomClimateFontSizeInUserUnits));
        }
      }

      const nodeLabels = svg.querySelectorAll('.node-label');
      for (const label of nodeLabels) {
        if (label instanceof SVGTextElement) {
          label.setAttribute('font-size', String(nodeFontSizeInUserUnits));
        }
      }

      const nodeDots = svg.querySelectorAll('.node-dot');
      for (const dot of nodeDots) {
        if (dot instanceof SVGCircleElement) {
          dot.setAttribute('r', String(nodeRadiusInUserUnits));
        }
      }

      const deviceMarkers = svg.querySelectorAll('.device-marker');
      for (const g of deviceMarkers) {
        if (!(g instanceof SVGGElement)) continue;

        const use = g.querySelector('.device-pin');
        if (use instanceof SVGUseElement) {
          use.setAttribute('width', String(devicePinWidthInUserUnits));
          use.setAttribute('height', String(devicePinHeightInUserUnits));
          use.setAttribute('x', String(-devicePinWidthInUserUnits / 2));
          use.setAttribute('y', String(-devicePinHeightInUserUnits));
        }

        const label = g.querySelector('.device-label');
        if (label instanceof SVGTextElement) {
          label.setAttribute('font-size', String(deviceLabelFontSizeInUserUnits * 1.35));
          label.setAttribute('x', '0');
          label.setAttribute(
            'y',
            String(-devicePinHeightInUserUnits - deviceLabelGapInUserUnits / 4)
          );
        }

        // Optional avatar/initials overlay within the pin.
        // The marker origin is the pin tip; the pin's bounding box is set above.
        // Match the `#devicePin` symbol proportions (viewBox 0..64):
        // - head circle is centered at y=24 (24/64 = 0.375)
        // - head circle diameter is 32 (32/64 = 0.5)
        // Avatar sizing/alignment tweaks:
        // - Slightly larger (a couple screen pixels) to fully cover the white disc
        // - Slightly lower to better center within the pin head area
        const avatarSizeInUserUnits = devicePinWidthInUserUnits * 0.54 + 2 * unitsPerPx;
        const avatarCenterY =
          -devicePinHeightInUserUnits + devicePinHeightInUserUnits * 0.375 + 4 * unitsPerPx;

        const avatarImage = g.querySelector('.device-avatar-image');
        if (avatarImage instanceof SVGImageElement) {
          avatarImage.setAttribute('width', String(avatarSizeInUserUnits));
          avatarImage.setAttribute('height', String(avatarSizeInUserUnits));
          avatarImage.setAttribute('x', String(-avatarSizeInUserUnits / 2));
          avatarImage.setAttribute('y', String(avatarCenterY - avatarSizeInUserUnits / 2));
        }

        const avatarText = g.querySelector('.device-avatar-text');
        if (avatarText instanceof SVGTextElement) {
          avatarText.setAttribute('font-size', String(avatarSizeInUserUnits * 0.42));
          avatarText.setAttribute('x', '0');
          avatarText.setAttribute('y', String(avatarCenterY));
        }
      }

      const lightToggles = svg.querySelectorAll('.light-toggle');
      for (const g of lightToggles) {
        if (!(g instanceof SVGGElement)) continue;

        const cx = Number(g.getAttribute('data-cx'));
        const cy = Number(g.getAttribute('data-cy'));
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

        const bgW = 34 * unitsPerPx;
        const bgH = 26 * unitsPerPx;
        const bgR = 10 * unitsPerPx;
        const iconSize = 18 * unitsPerPx;
        const yOffset = 28 * unitsPerPx;

        g.setAttribute('transform', `translate(${cx} ${cy + yOffset})`);

        const bg = g.querySelector('.light-toggle-bg');
        if (bg instanceof SVGRectElement) {
          bg.setAttribute('width', String(bgW));
          bg.setAttribute('height', String(bgH));
          bg.setAttribute('x', String(-bgW / 2));
          bg.setAttribute('y', String(-bgH / 2));
          bg.setAttribute('rx', String(bgR));
          bg.setAttribute('ry', String(bgR));
        }

        const icon = g.querySelector('.light-toggle-icon');
        if (icon instanceof SVGUseElement) {
          icon.setAttribute('width', String(iconSize));
          icon.setAttribute('height', String(iconSize));
          icon.setAttribute('x', String(-iconSize / 2));
          icon.setAttribute('y', String(-iconSize / 2));
        }
      }
    };

    const clampScale = (s) => Math.min(maxScale, Math.max(minScale, s));

    const scaleFromViewBox = (vb) => {
      if (!vb?.w) return 1.0;
      return clampScale(baseViewBox.w / vb.w);
    };

    const formatNumber = (value, decimals) => {
      if (!Number.isFinite(value)) return '';
      return value.toFixed(decimals);
    };

    const updateLaunchReadout = (vb) => {
      const computedScale = scaleFromViewBox(vb);
      const percent = Math.round(computedScale * 100);

      if (launchScaleValue instanceof HTMLElement) {
        launchScaleValue.textContent = formatNumber(computedScale, 3);
      }
      if (launchPercentValue instanceof HTMLElement) {
        launchPercentValue.textContent = `(${percent}%)`;
      }
      if (launchXValue instanceof HTMLElement) {
        launchXValue.textContent = formatNumber(vb.x, 2);
      }
      if (launchYValue instanceof HTMLElement) {
        launchYValue.textContent = formatNumber(vb.y, 2);
      }
    };

    const applyViewBox = (vb) => {
      current = vb;
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      updateRoomLabelSizes(14);
      updateLaunchReadout(vb);
    };

    const readViewBox = () => {
      const parts = String(svg.getAttribute('viewBox') || '')
        .trim()
        .split(/\s+/)
        .map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
      return { ...current };
    };

    const clientToSvg = (clientX, clientY) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const inv = ctm.inverse();

      if (typeof DOMPoint !== 'undefined') {
        const pt = new DOMPoint(clientX, clientY);
        const out = pt.matrixTransform(inv);
        return { x: out.x, y: out.y };
      }

      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const out = pt.matrixTransform(inv);
      return { x: out.x, y: out.y };
    };

    const syncControls = () => {
      const vb = readViewBox();
      const computedScale = scaleFromViewBox(vb);
      scale = computedScale;
      const percent = Math.round(computedScale * 100);
      if (zoomSlider instanceof HTMLInputElement) zoomSlider.value = String(percent);
      if (zoomValue instanceof HTMLElement) zoomValue.textContent = `${percent}%`;
    };

    const applyInitialView = () => {
      const yamlScale = Number(initialView?.scale);
      const initialScale = clampScale(Number.isFinite(yamlScale) ? yamlScale : 1.0);
      scale = initialScale;

      const initialW = baseViewBox.w / initialScale;
      const initialH = baseViewBox.h / initialScale;

      const centeredX = baseViewBox.x + (baseViewBox.w - initialW) / 2;
      const centeredY = baseViewBox.y + (baseViewBox.h - initialH) / 2;

      const yamlX = Number(initialView?.x);
      const yamlY = Number(initialView?.y);
      const x = Number.isFinite(yamlX) ? yamlX : centeredX;
      const y = Number.isFinite(yamlY) ? yamlY : centeredY;

      applyViewBox({ x, y, w: initialW, h: initialH });
      syncControls();
    };

    const viewBoxForScaleAround = (startVb, nextScale, focalSvg) => {
      const newW = baseViewBox.w / nextScale;
      const newH = baseViewBox.h / nextScale;
      const fx = focalSvg.x;
      const fy = focalSvg.y;
      const newX = fx - ((fx - startVb.x) * newW) / startVb.w;
      const newY = fy - ((fy - startVb.y) * newH) / startVb.h;
      return { x: newX, y: newY, w: newW, h: newH };
    };

    const setScaleAround = (nextScale, focalSvg) => {
      const vb = readViewBox();
      const clamped = clampScale(nextScale);
      scale = clamped;
      applyViewBox(viewBoxForScaleAround(vb, clamped, focalSvg));
      syncControls();
    };

    const panByPixels = (dxPx, dyPx) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const vb = readViewBox();
      const dx = (dxPx * vb.w) / rect.width;
      const dy = (dyPx * vb.h) / rect.height;
      applyViewBox({ ...vb, x: vb.x - dx, y: vb.y - dy });
    };

    applyInitialView();

    // On first load, the SVG can briefly report 0x0 size while layout settles.
    // If we bail out then, device labels may render at a browser default font size
    // (appearing gigantic) until the user zooms/pans. Schedule a post-layout sync
    // and also react to future resizes.
    const scheduleLabelSizeSync = () => {
      window.requestAnimationFrame(() => {
        updateRoomLabelSizes(14);
      });
    };

    scheduleLabelSizeSync();

    if (typeof window.ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => {
        scheduleLabelSizeSync();
      });
      ro.observe(svg);

      // Ensure we clean up if this gets re-initialized.
      window.addEventListener(
        'beforeunload',
        () => {
          try {
            ro.disconnect();
          } catch {
            // ignore
          }
        },
        { once: true }
      );
    }

    window.addEventListener('resize', () => {
      updateRoomLabelSizes(14);
    });

    // Mouse wheel zoom (desktop/laptop)
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const focal = clientToSvg(e.clientX, e.clientY);
        const zoomFactor = Math.pow(1.0016, -e.deltaY);
        const nextScale = clampScale(scale * zoomFactor);
        setScaleAround(nextScale, focal);
      },
      { passive: false }
    );

    // Pointer: click-drag pan (mouse). Touch: pinch zoom + two-finger pan.
    svg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      if (e.pointerType === 'mouse' && e.button === 0) {
        // Do not immediately capture the pointer.
        // Capturing on pointerdown can cause the subsequent click to be retargeted
        // to the SVG (instead of the room), preventing room selection.
        mouseDragging = false;
        dragMoved = false;
        dragStart = { x: e.clientX, y: e.clientY };
      }

      if (e.pointerType !== 'mouse' && pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const a = pts[0];
        const b = pts[1];
        const startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const startDist = Math.hypot(a.x - b.x, a.y - b.y);
        gestureStart = {
          startViewBox: readViewBox(),
          startScale: scale,
          startMid,
          startDist,
          startMidSvg: clientToSvg(startMid.x, startMid.y),
        };
        svg.classList.add('is-panning');
        e.preventDefault();
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });

      if (e.pointerType === 'mouse') {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;

        if (dragStart) {
          const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
          // Start panning only after a small movement threshold.
          if (!mouseDragging && moved > 4) {
            mouseDragging = true;
            dragMoved = true;
            svg.classList.add('is-panning');
            try {
              svg.setPointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }
        }

        if (mouseDragging) {
          panByPixels(dx, dy);
          e.preventDefault();
          return;
        }
      }

      if (e.pointerType !== 'mouse' && pointers.size === 2 && gestureStart) {
        const pts = Array.from(pointers.values());
        const a = pts[0];
        const b = pts[1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        const zoomFactor = gestureStart.startDist > 0 ? dist / gestureStart.startDist : 1;
        const nextScale = clampScale(gestureStart.startScale * zoomFactor);
        const vb1 = viewBoxForScaleAround(
          gestureStart.startViewBox,
          nextScale,
          gestureStart.startMidSvg
        );

        // Apply two-finger pan based on midpoint movement
        const rect = svg.getBoundingClientRect();
        if (rect.width && rect.height) {
          const dxPx = mid.x - gestureStart.startMid.x;
          const dyPx = mid.y - gestureStart.startMid.y;
          vb1.x -= (dxPx * vb1.w) / rect.width;
          vb1.y -= (dyPx * vb1.h) / rect.height;
        }

        scale = nextScale;
        applyViewBox(vb1);
        syncControls();
        e.preventDefault();
      }
    });

    const endPointer = (e) => {
      const wasMouse = e.pointerType === 'mouse';
      pointers.delete(e.pointerId);

      if (wasMouse) {
        mouseDragging = false;
        svg.classList.remove('is-panning');
        if (dragMoved) {
          suppressRoomClick = true;
          setTimeout(() => {
            suppressRoomClick = false;
          }, 0);
        }
        dragStart = null;
        dragMoved = false;
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (pointers.size < 2) {
        gestureStart = null;
        svg.classList.remove('is-panning');
        // Two-finger gestures should not trigger room clicks.
        suppressRoomClick = true;
        setTimeout(() => {
          suppressRoomClick = false;
        }, 0);
      }
    };

    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);

    // Slider zoom (starter on-screen control)
    if (zoomSlider instanceof HTMLInputElement) {
      zoomSlider.addEventListener('input', () => {
        const nextScale = clampScale(Number(zoomSlider.value) / 100);
        const vb = readViewBox();
        const focal = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
        setScaleAround(nextScale, focal);
      });
    }

    // Arrow pad + keyboard arrows
    const panStep = (dxSign, dySign) => {
      const vb = readViewBox();
      applyViewBox({
        ...vb,
        x: vb.x + vb.w * 0.1 * dxSign,
        y: vb.y + vb.h * 0.1 * dySign,
      });
    };

    const bindPanButton = (el, dx, dy) => {
      if (!(el instanceof HTMLButtonElement)) return;
      el.addEventListener('click', () => panStep(dx, dy));
    };

    bindPanButton(panUp, 0, -1);
    bindPanButton(panDown, 0, 1);
    bindPanButton(panLeft, -1, 0);
    bindPanButton(panRight, 1, 0);

    window.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (typing) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        panStep(0, -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        panStep(0, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        panStep(-1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        panStep(1, 0);
      }
    });
  }

  function normalizeYamlText(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/);
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim() === '') continue;
      const leading = (line.match(/^\s*/) || [''])[0].length;
      minIndent = Math.min(minIndent, leading);
    }
    if (!Number.isFinite(minIndent) || minIndent <= 0) return raw;
    return lines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l)).join('\n');
  }

  function isProbablyHtml(text) {
    const trimmed = String(text || '')
      .trimStart()
      .toLowerCase();
    if (!trimmed) return false;
    if (trimmed.startsWith('<!doctype html')) return true;
    if (trimmed.startsWith('<html')) return true;
    return trimmed.startsWith('<') && trimmed.includes('<head') && trimmed.includes('<body');
  }

  async function loadYamlText(path, fallbackId) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (isProbablyHtml(text)) {
          return { text: '', source: 'none' };
        }
        return { text, source: 'fetch' };
      }
    } catch {
      // ignore
    }
    if (fallbackId) {
      const fallback = document.getElementById(fallbackId);
      if (fallback) {
        return { text: fallback.textContent || '', source: 'fallback' };
      }
    }
    return { text: '', source: 'none' };
  }

  function toRadians(deg) {
    return (deg * Math.PI) / 180;
  }

  function gpsToLocalMeters(deviceGps, originGps) {
    if (!Array.isArray(deviceGps) || deviceGps.length < 2) return null;
    if (!originGps || typeof originGps !== 'object') return null;

    const lat = Number(deviceGps[0]);
    const lon = Number(deviceGps[1]);
    const elev = deviceGps.length >= 3 ? Number(deviceGps[2]) : Number.NaN;

    const lat0 = Number(originGps.latitude);
    const lon0 = Number(originGps.longitude);
    const elev0 = Number(originGps.elevation || 0);

    if (![lat, lon, lat0, lon0].every(Number.isFinite)) return null;

    // Local tangent-plane approximation (meters): x=east, y=north
    const R = 6378137;
    const dLat = toRadians(lat - lat0);
    const dLon = toRadians(lon - lon0);
    const x = dLon * Math.cos(toRadians(lat0)) * R;
    const y = dLat * R;
    const z = Number.isFinite(elev) ? elev - elev0 : 0;

    return { x, y, z };
  }

  function getVisibleSidebarPanel() {
    const agendaEl = document.getElementById('agenda');
    const mediaEl = document.getElementById('media-window');
    const climateEl = document.getElementById('climate-panel');
    const lightingEl = document.getElementById('lighting-panel');

    if (lightingEl instanceof HTMLElement && !lightingEl.classList.contains('is-hidden')) {
      return 'lighting';
    }

    if (mediaEl instanceof HTMLElement && !mediaEl.classList.contains('is-hidden')) {
      return 'media';
    }

    if (climateEl instanceof HTMLElement && !climateEl.classList.contains('is-hidden')) {
      return 'climate';
    }

    if (agendaEl instanceof HTMLElement && !agendaEl.classList.contains('is-hidden')) {
      return 'agenda';
    }

    return null;
  }

  function setSidebarPanel(panel) {
    const agendaEl = document.getElementById('agenda');
    const mediaEl = document.getElementById('media-window');
    const climateEl = document.getElementById('climate-panel');
    const lightingEl = document.getElementById('lighting-panel');

    const agendaToggle = document.getElementById('agenda-toggle');
    const mediaToggle = document.getElementById('media-toggle');
    const climateToggle = document.getElementById('climate-toggle');
    const lightingToggle = document.getElementById('lighting-toggle');

    if (
      !(agendaEl instanceof HTMLElement) ||
      !(mediaEl instanceof HTMLElement) ||
      !(climateEl instanceof HTMLElement) ||
      !(lightingEl instanceof HTMLElement)
    ) {
      return;
    }

    const showAgenda = panel === 'agenda';
    const showMedia = panel === 'media';
    const showClimate = panel === 'climate';
    const showLighting = panel === 'lighting';

    agendaEl.classList.toggle('is-hidden', !showAgenda);
    mediaEl.classList.toggle('is-hidden', !showMedia);
    climateEl.classList.toggle('is-hidden', !showClimate);
    lightingEl.classList.toggle('is-hidden', !showLighting);

    if (agendaToggle instanceof HTMLButtonElement) {
      agendaToggle.setAttribute('aria-expanded', showAgenda ? 'true' : 'false');
    }
    if (mediaToggle instanceof HTMLButtonElement) {
      mediaToggle.setAttribute('aria-expanded', showMedia ? 'true' : 'false');
    }
    if (climateToggle instanceof HTMLButtonElement) {
      climateToggle.setAttribute('aria-expanded', showClimate ? 'true' : 'false');
    }
    if (lightingToggle instanceof HTMLButtonElement) {
      lightingToggle.setAttribute('aria-expanded', showLighting ? 'true' : 'false');
    }

    setClimateOverlayVisible(showClimate);
    setLightingOverlayVisible(showLighting);
  }

  function setClimateOverlayVisible(visible) {
    const svg = document.getElementById('floorplan-svg');
    if (!(svg instanceof SVGSVGElement)) return;

    const roomClimate = svg.querySelectorAll('.room-climate');
    for (const el of roomClimate) {
      if (el instanceof SVGTextElement) {
        el.classList.toggle('is-hidden', !visible);
      }
    }
  }

  function setLightingOverlayVisible(visible) {
    const svg = document.getElementById('floorplan-svg');
    if (!(svg instanceof SVGSVGElement)) return;

    const toggles = svg.querySelectorAll('.light-toggle');
    for (const el of toggles) {
      if (el instanceof SVGGElement) {
        el.classList.toggle('is-hidden', !visible);
      }
    }
  }

  function enableMediaToggle() {
    const toggleButton = document.getElementById('media-toggle');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    if (toggleButton.hasAttribute(BOUND_MARKER_ATTR)) return;
    toggleButton.setAttribute(BOUND_MARKER_ATTR, 'true');

    toggleButton.addEventListener('click', () => {
      const visible = getVisibleSidebarPanel();
      setSidebarPanel(visible === 'media' ? 'agenda' : 'media');
    });
  }

  function enableClimateToggle() {
    const toggleButton = document.getElementById('climate-toggle');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    if (toggleButton.hasAttribute(BOUND_MARKER_ATTR)) return;
    toggleButton.setAttribute(BOUND_MARKER_ATTR, 'true');

    toggleButton.addEventListener('click', () => {
      const visible = getVisibleSidebarPanel();
      setSidebarPanel(visible === 'climate' ? 'agenda' : 'climate');
    });
  }

  function enableLightingToggle() {
    const toggleButton = document.getElementById('lighting-toggle');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    if (toggleButton.hasAttribute(BOUND_MARKER_ATTR)) return;
    toggleButton.setAttribute(BOUND_MARKER_ATTR, 'true');

    toggleButton.addEventListener('click', () => {
      const visible = getVisibleSidebarPanel();
      setSidebarPanel(visible === 'lighting' ? null : 'lighting');
    });
  }

  function enableAgendaToggle() {
    const toggleButton = document.getElementById('agenda-toggle');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    if (toggleButton.hasAttribute(BOUND_MARKER_ATTR)) return;
    toggleButton.setAttribute(BOUND_MARKER_ATTR, 'true');

    toggleButton.addEventListener('click', () => {
      const visible = getVisibleSidebarPanel();
      setSidebarPanel(visible === 'agenda' ? null : 'agenda');
    });
  }

  function dashboardDomReady() {
    return (
      document.getElementById('floorplan-svg') instanceof SVGSVGElement &&
      document.getElementById('lighting-toggle') instanceof HTMLButtonElement &&
      document.getElementById('climate-toggle') instanceof HTMLButtonElement
    );
  }

  async function init() {
    const root = document.getElementById('root');
    if (root && root.getAttribute(INIT_MARKER_ATTR) === 'true') {
      return;
    }
    if (root) root.setAttribute(INIT_MARKER_ATTR, 'true');

    enableMediaToggle();
    enableClimateToggle();
    enableLightingToggle();
    enableAgendaToggle();

    const initialPanel = getVisibleSidebarPanel();
    setSidebarPanel(initialPanel || 'climate');
    const statusEl = document.getElementById('floorplan-status');
    const emptyEl = document.getElementById('floorplan-empty');
    const emptyMessageEl = document.getElementById('floorplan-empty-message');
    const retryButton = document.getElementById('floorplan-retry');

    const showEmptyMessage = (msg) => {
      if (statusEl) statusEl.textContent = msg;
      if (emptyMessageEl) emptyMessageEl.textContent = msg;
      if (emptyEl) emptyEl.classList.remove('is-hidden');
      if (retryButton instanceof HTMLButtonElement) retryButton.disabled = false;
    };

    const hideEmptyMessage = () => {
      if (emptyEl) emptyEl.classList.add('is-hidden');
    };

    const loadAndRender = async () => {
      if (retryButton instanceof HTMLButtonElement) retryButton.disabled = true;

      try {
        const [
          { text, source },
          { text: devicesText, source: devicesSource },
          { text: climateText, source: climateSource },
          { text: lightingText, source: lightingSource },
        ] = await Promise.all([
          loadYamlText('/data/floorplan.yaml', ''),
          loadYamlText('/data/devices.yaml', ''),
          loadYamlText('/data/climate.yaml', ''),
          loadYamlText('/data/lighting.yaml', ''),
        ]);

        if (!String(text || '').trim()) {
          const msg =
            'No floorplan.yaml has been provided.\n\n' +
            'If you have not created your own yet, please copy the provided floorplan-example.yaml and name it floorplan.yaml so you have a working example.';
          showEmptyMessage(msg);
          console.error(msg);
          return;
        }

        const normalized = normalizeYamlText(text);
        if (isProbablyHtml(normalized)) {
          const msg =
            'No floorplan.yaml has been provided.\n\n' +
            'If you have not created your own yet, please copy the provided floorplan-example.yaml and name it floorplan.yaml so you have a working example.';
          showEmptyMessage(msg);
          console.error(msg);
          return;
        }
        const doc = parseYamlLite(normalized);

        const normalizedDevices = normalizeYamlText(devicesText);
        const devicesDoc = parseYamlLite(normalizedDevices);

        const normalizedClimate = normalizeYamlText(climateText);
        let climateDoc = null;
        if (String(normalizedClimate || '').trim() && !isProbablyHtml(normalizedClimate)) {
          try {
            climateDoc = parseYamlLite(normalizedClimate);
          } catch (err) {
            climateDoc = null;
            console.warn('climate.yaml present but could not be parsed; ignoring.', err);
          }
        }

        const normalizedLighting = normalizeYamlText(lightingText);
        let lightingDoc = null;
        if (String(normalizedLighting || '').trim() && !isProbablyHtml(normalizedLighting)) {
          try {
            lightingDoc = parseYamlLite(normalizedLighting);
          } catch {
            lightingDoc = null;
          }
        }

        const lightingModel = normalizeLightingDoc(lightingDoc);
        const floorsCount = Array.isArray(doc?.floors) ? doc.floors.length : 0;

        if (floorsCount === 0) {
          const msg =
            'No floorplan.yaml has been provided.\n\n' +
            'If you have not created your own yet, please copy the provided floorplan-example.yaml and name it floorplan.yaml so you have a working example.';
          showEmptyMessage(msg);
          console.error(msg);
          return;
        }

        hideEmptyMessage();

        const result = renderFloorplan(doc, devicesDoc, climateDoc, lightingModel);
        if (result?.baseViewBox) {
          enablePanZoom(result.baseViewBox, result.initialView);
        }

        // Ensure map overlays reflect initial visible panel state.
        const visiblePanel = getVisibleSidebarPanel();
        setClimateOverlayVisible(visiblePanel === 'climate');
        setLightingOverlayVisible(visiblePanel === 'lighting');

        // Ensure map overlay reflects current sidebar state (and not just the initial DOM classes).
        setClimateOverlayVisible(getVisibleSidebarPanel() === 'climate');

        if (climateDoc) {
          applyClimatePanel(climateDoc);
        }

        applyLightingPanel(lightingModel);
        const roomsCount = result?.roomsCount ?? 0;
        const devicesCount = result?.devicesCount ?? 0;
        const floorId = result?.floorId ?? 'unknown';
        const viewBox = result?.viewBox ?? '(none)';

        const defaultFloorId =
          typeof doc?.default_floor_id === 'string' ? String(doc.default_floor_id).trim() : '';
        const defaultFloorMatch =
          defaultFloorId && floorId ? defaultFloorId === String(floorId).trim() : false;
        const defaultFloorNote = defaultFloorId
          ? defaultFloorMatch
            ? ' (matched)'
            : ' (no match)'
          : '';

        const msg =
          `Floorplan: ok\n` +
          `source: ${source}\n` +
          `devices: ${devicesSource}\n` +
          `climate: ${climateSource}\n` +
          `lighting: ${lightingSource}\n` +
          `default_floor_id: ${defaultFloorId || '(none)'}${defaultFloorNote}\n` +
          `floors: ${floorsCount}  floor: ${floorId}\n` +
          `rooms: ${roomsCount}\n` +
          `devices: ${devicesCount}\n` +
          `viewBox: ${viewBox}`;

        if (statusEl) statusEl.textContent = msg;
        console.debug(msg);
      } catch (err) {
        const msg = `Floorplan: ERROR\n${String(err)}`;
        showEmptyMessage(msg);
        console.error(err);
      } finally {
        if (retryButton instanceof HTMLButtonElement) retryButton.disabled = false;
      }
    };

    if (retryButton instanceof HTMLButtonElement) {
      retryButton.addEventListener('click', () => {
        void loadAndRender();
      });
    }

    await loadAndRender();
  }

  function boot() {
    if (dashboardDomReady()) {
      void init();
      return;
    }

    // In React, this script runs before the app renders.
    // Poll briefly until the Dashboard DOM exists.
    let attempts = 0;
    const maxAttempts = 300;
    const tick = () => {
      if (dashboardDomReady()) {
        void init();
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  function normalizeLightingDoc(lightingDoc) {
    const rawLights = Array.isArray(lightingDoc?.lights) ? lightingDoc.lights : [];

    const lights = rawLights
      .filter((l) => l && typeof l === 'object')
      .map((l) => {
        const id = String(l.id || '').trim();
        const name = String(l.name || l.id || '').trim();
        const state = String(l.state || '')
          .trim()
          .toLowerCase();
        const explicitRoomId = typeof l.room_id === 'string' ? String(l.room_id).trim() : '';

        // Hotwire: the NORAD real-world light entity doesn't share the room id.
        // Assign it to the NORAD room so the in-map light toggle button exists.
        const roomId =
          explicitRoomId ||
          (id === 'light.norad_corner_torch'
            ? 'norad'
            : id.startsWith('light.')
              ? id.slice('light.'.length)
              : '');
        return {
          id,
          name,
          roomId,
          state: state === 'on' ? 'on' : 'off',
        };
      })
      .filter((l) => l.id && l.name && l.roomId);

    const byRoomId = new Map();
    for (const light of lights) {
      const arr = byRoomId.get(light.roomId) || [];
      arr.push(light);
      byRoomId.set(light.roomId, arr);
    }

    return { lights, byRoomId };
  }

  function applyLightingPanel(lightingModel) {
    const listEl = document.getElementById('lighting-list');
    const emptyEl = document.getElementById('lighting-empty');
    if (!(listEl instanceof HTMLElement) || !(emptyEl instanceof HTMLElement)) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    const lights = Array.isArray(lightingModel?.lights) ? lightingModel.lights : [];
    const onLights = lights.filter((l) => String(l.state || '').toLowerCase() === 'on');

    if (!onLights.length) {
      emptyEl.classList.remove('is-hidden');
      return;
    }

    emptyEl.classList.add('is-hidden');

    for (const light of onLights) {
      const item = document.createElement('li');
      item.className = 'lighting-item';

      const name = document.createElement('div');
      name.className = 'lighting-name';
      name.textContent = light.name;

      const meta = document.createElement('div');
      meta.className = 'lighting-meta';
      meta.textContent = light.roomId.replace(/_/g, ' ');

      item.appendChild(name);
      item.appendChild(meta);
      listEl.appendChild(item);
    }
  }

  function applyClimatePanel(climateDoc) {
    const defaults =
      climateDoc?.thermostat && typeof climateDoc.thermostat === 'object'
        ? climateDoc.thermostat.default
        : null;

    if (!defaults || typeof defaults !== 'object') return;

    const unit = typeof defaults.unit === 'string' ? String(defaults.unit).trim() : '°F';
    const precisionRaw = Number(defaults.precision);
    const precision = Number.isFinite(precisionRaw) ? Math.max(0, Math.min(3, precisionRaw)) : 0;
    const fmtTemp = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '';
      return `${n.toFixed(precision)}${unit}`;
    };

    const setTempEl = document.getElementById('thermostat-temp');
    const humidityEl = document.getElementById('thermostat-humidity');
    const modeEl = document.getElementById('thermostat-mode');
    const minEl = document.getElementById('temp-range-min');
    const maxEl = document.getElementById('temp-range-max');
    const indicatorEl = document.getElementById('temp-range-indicator');

    const setTemp = Number(defaults.set_temperature);
    const measuredHumidity = Number(defaults.measured_humidity);
    const hvacMode = typeof defaults.hvac_mode === 'string' ? String(defaults.hvac_mode) : '';

    if (setTempEl instanceof HTMLElement) {
      const formatted = fmtTemp(setTemp);
      if (formatted) setTempEl.textContent = formatted;
    }
    if (humidityEl instanceof HTMLElement) {
      if (Number.isFinite(measuredHumidity)) {
        humidityEl.textContent = `${Math.round(measuredHumidity)}%`;
      }
    }
    if (modeEl instanceof HTMLElement) {
      if (hvacMode) {
        modeEl.textContent = hvacMode
          .split('_')
          .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    const areas = Array.isArray(climateDoc?.areas) ? climateDoc.areas : [];
    const temps = [];
    for (const area of areas) {
      if (!area || typeof area !== 'object') continue;
      const t = Number(area.temp);
      if (Number.isFinite(t)) temps.push(t);
    }
    if (!temps.length) return;

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);

    if (minEl instanceof HTMLElement) {
      minEl.textContent = fmtTemp(minTemp) || minEl.textContent;
    }
    if (maxEl instanceof HTMLElement) {
      maxEl.textContent = fmtTemp(maxTemp) || maxEl.textContent;
    }

    if (indicatorEl instanceof HTMLElement && Number.isFinite(setTemp)) {
      const denom = maxTemp - minTemp;
      const ratio = denom === 0 ? 0.5 : (setTemp - minTemp) / denom;
      const clamped = Math.max(0, Math.min(1, ratio));
      indicatorEl.style.left = `${clamped * 100}%`;
      const setLabel = fmtTemp(setTemp);
      if (setLabel) {
        indicatorEl.setAttribute('title', `Setpoint: ${setLabel}`);
      }
    }
  }
})();
