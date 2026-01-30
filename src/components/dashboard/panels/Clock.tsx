import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';

import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';

const hourAsText = (value: number): string | undefined => {
  switch (value) {
    case 1:
      return 'one';
    case 2:
      return 'two';
    case 3:
      return 'three';
    case 4:
      return 'four';
    case 5:
      return 'five';
    case 6:
      return 'six';
    case 7:
      return 'seven';
    case 8:
      return 'eight';
    case 9:
      return 'nine';
    case 10:
      return 'ten';
    case 11:
      return 'eleven';
    case 12:
      return 'twelve';
  }
};

type ClockState = Readonly<{
  hourText: string;
  minuteText: string;
  ampm: 'AM' | 'PM';
  isDividerVisible: boolean;
  iconName: string;
  dateText: string;
}>;

const formatDate = (d: Date): string => {
  // Match requested format: "Friday, Jan 3, 2026".
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
};

const parseHaSeedDate = (entity: HaEntityState | undefined): Date | null => {
  if (!entity) return null;
  const raw = typeof entity.state === 'string' ? entity.state.trim() : '';
  if (!raw) return null;

  // Prefer ISO-8601 timestamps when available (e.g. `sensor.date_time_iso`).
  const parsedIso = Date.parse(raw);
  if (Number.isFinite(parsedIso)) return new Date(parsedIso);

  // Support `HH:MM` (e.g. `sensor.time`) by combining with today's date.
  const hhmm = raw.match(/^(?<hh>\d{1,2}):(?<mm>\d{2})$/);
  if (hhmm?.groups) {
    const hh = Number.parseInt(hhmm.groups.hh, 10);
    const mm = Number.parseInt(hhmm.groups.mm, 10);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      return d;
    }
  }

  return null;
};

const findHaSeedDate = (entitiesById: Record<string, HaEntityState>): Date | null => {
  // Common HA sensors that can represent a canonical "home time".
  const candidates = ['sensor.date_time_iso', 'sensor.date_time', 'sensor.time'];
  for (const entityId of candidates) {
    const seed = parseHaSeedDate(entitiesById[entityId]);
    if (seed) return seed;
  }
  return null;
};

const readClockState = (d: Date): ClockState => {
  const hour24 = d.getHours();
  const minute = d.getMinutes();
  const isDividerVisible = d.getSeconds() % 2 === 0;

  const ampm: ClockState['ampm'] = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 > 12 ? hour24 - 12 : hour24;
  hour12 = hour12 === 0 ? 12 : hour12;

  const hourText = String(hour12);
  const minuteText = minute < 10 ? '0' + minute : String(minute);

  const hourIconToken = hourAsText(hour12) ?? 'twelve';
  const iconName = `mdi:clock-time-${hourIconToken}${hour24 > 5 && hour24 < 18 ? '' : '-outline'}`;

  return { hourText, minuteText, ampm, isDividerVisible, iconName, dateText: formatDate(d) };
};

export function Clock() {
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const lastUpdatedAt = useEntityStore((s) => s.lastUpdatedAt);

  const hasSeededFromHaRef = useRef(false);
  const timeOffsetMsRef = useRef(0);

  const [clockState, setClockState] = useState<ClockState>(() => readClockState(new Date()));

  useEffect(() => {
    // Seed once, if a suitable HA entity is present.
    if (hasSeededFromHaRef.current) return;
    const seedDate = findHaSeedDate(entitiesById);
    if (!seedDate) return;

    timeOffsetMsRef.current = seedDate.getTime() - Date.now();
    hasSeededFromHaRef.current = true;
    setClockState(readClockState(new Date(Date.now() + timeOffsetMsRef.current)));
  }, [entitiesById, lastUpdatedAt]);

  useEffect(() => {
    const tick = () => {
      setClockState(readClockState(new Date(Date.now() + timeOffsetMsRef.current)));
    };

    tick();

    const interval = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="clock" aria-label="Clock">
      <div className="clock-icon" aria-hidden="true">
        <Icon
          icon={clockState.iconName}
          aria-hidden="true"
          data-testid="clock-icon"
          className="clock-icon"
        />
      </div>
      <div>
        <div className="clock-time">
          {clockState.hourText}
          <span
            className={
              clockState.isDividerVisible ? 'clock-divider' : 'clock-divider clock-divider--off'
            }
            aria-hidden="true"
          >
            :
          </span>
          {clockState.minuteText} {clockState.ampm}
        </div>
        <div className="clock-timezone">{clockState.dateText}</div>
      </div>
    </div>
  );
}
