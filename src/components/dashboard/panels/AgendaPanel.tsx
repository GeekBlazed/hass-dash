export function AgendaPanel({ isHidden = true }: { isHidden?: boolean }) {
  return (
    <div className={isHidden ? 'agenda is-hidden' : 'agenda'} id="agenda" aria-label="Agenda">
      <div className="item">
        <div className="name">Weekend In</div>
        <div className="time">Until 7:00 PM</div>
      </div>
      <div className="item">
        <div className="name">Lunch at the park</div>
        <div className="time">11:00 AM – 2:00 PM</div>
      </div>
      <div className="item">
        <div className="name">Install New Home Batteries and Solar</div>
        <div className="time">All Day</div>
      </div>
      <div className="item">
        <div className="name">Take Out Garbage</div>
        <div className="time">All Day</div>
      </div>
      <div className="item">
        <div className="name">Farmers Market</div>
        <div className="time">All Day</div>
      </div>
    </div>
  );
}
