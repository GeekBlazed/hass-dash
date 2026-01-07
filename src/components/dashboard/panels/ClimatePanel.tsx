export function ClimatePanel({ isHidden = false }: { isHidden?: boolean }) {
  return (
    <section
      id="climate-panel"
      className={isHidden ? 'tile climate-panel is-hidden' : 'tile climate-panel'}
      aria-label="Climate controls"
    >
      <div className="thermostat" aria-label="Thermostat">
        <div className="thermostat__temp" id="thermostat-temp">
          71°F
        </div>
        <div className="thermostat__meta">
          <div>
            <strong>Humidity</strong>: <span id="thermostat-humidity">47%</span>
          </div>
          <div>
            <strong>Mode</strong>: <span id="thermostat-mode">Cool</span>
          </div>
        </div>
      </div>

      <div className="temp-range" aria-label="Home temperature range">
        <div className="temp-range__row">
          <span id="temp-range-min">68°F</span>
          <span id="temp-range-max">78°F</span>
        </div>
        <div className="temp-range__bar" aria-hidden="true">
          <span
            className="temp-range__indicator"
            id="temp-range-indicator"
            title="Setpoint: 71°F"
          ></span>
        </div>
      </div>
    </section>
  );
}
