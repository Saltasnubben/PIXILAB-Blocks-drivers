import { useMemo } from 'react';
import {
  format,
  eachDayOfInterval,
  isWithinInterval,
  differenceInDays,
  differenceInHours,
  startOfDay,
  parseISO,
  max,
  min
} from 'date-fns';
import { sv } from 'date-fns/locale';

function Timeline({ crew, bookings, dateRange, loading }) {
  // Generate days for the timeline header
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end
    });
  }, [dateRange]);

  const totalDays = days.length;

  // Group bookings by crew member
  const bookingsByCrew = useMemo(() => {
    const grouped = {};

    crew.forEach(member => {
      grouped[member.id] = bookings.filter(b => b.crewId === member.id);
    });

    return grouped;
  }, [crew, bookings]);

  // Calculate position and width for a booking bar
  const getBookingStyle = (booking) => {
    const bookingStart = startOfDay(parseISO(booking.start));
    const bookingEnd = startOfDay(parseISO(booking.end));

    // Clamp to visible range
    const visibleStart = max([bookingStart, dateRange.start]);
    const visibleEnd = min([bookingEnd, dateRange.end]);

    const startOffset = differenceInDays(visibleStart, dateRange.start);
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
      backgroundColor: booking.projectColor || '#3b82f6'
    };
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400">Laddar bokningar...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Timeline header with days */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Crew name column */}
        <div className="w-56 flex-shrink-0 px-4 py-3 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
          Crewmedlem
        </div>

        {/* Days */}
        <div className="flex-1 flex">
          {days.map((day, index) => (
            <div
              key={day.toISOString()}
              className={`flex-1 px-2 py-3 text-center text-sm border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${
                format(day, 'E', { locale: sv }) === 'lör' ||
                format(day, 'E', { locale: sv }) === 'sön'
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : ''
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {format(day, 'd', { locale: sv })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(day, 'EEE', { locale: sv })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {crew.map(member => {
          const memberBookings = bookingsByCrew[member.id] || [];
          // Beräkna radhöjd baserat på antal bokningar
          const rowHeight = Math.max(80, memberBookings.length * 52 + 16);

          return (
            <div key={member.id} className="flex" style={{ minHeight: `${rowHeight}px` }}>
              {/* Crew name */}
              <div className="w-56 flex-shrink-0 px-4 py-3 border-r border-gray-200 dark:border-gray-700 flex items-start gap-2 bg-gray-50/50 dark:bg-gray-900/50">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: member.color || '#3b82f6' }}
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  {member.name}
                </span>
              </div>

              {/* Bookings area */}
              <div className="flex-1 relative py-2 px-1">
                {/* Day grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day, index) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${
                        format(day, 'E', { locale: sv }) === 'lör' ||
                        format(day, 'E', { locale: sv }) === 'sön'
                          ? 'bg-gray-50/50 dark:bg-gray-900/30'
                          : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Booking bars */}
                {memberBookings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                    Inga bokningar
                  </div>
                ) : (
                  <div className="relative h-full">
                    {memberBookings.map((booking, index) => (
                      <div
                        key={booking.id}
                        className="absolute rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md group"
                        style={{
                          ...getBookingStyle(booking),
                          top: `${index * 52 + 4}px`,
                          height: '48px'
                        }}
                        title={`${booking.projectName}\n${booking.role}\n${format(parseISO(booking.start), 'HH:mm')} - ${format(parseISO(booking.end), 'HH:mm')}`}
                      >
                        <div className="h-full px-3 py-1 flex flex-col justify-center overflow-hidden">
                          <span className="text-white text-sm font-semibold truncate drop-shadow-sm">
                            {booking.projectName}
                          </span>
                          <span className="text-white/80 text-xs truncate drop-shadow-sm">
                            {booking.role !== booking.projectName ? booking.role : ''}
                            {format(parseISO(booking.start), 'HH:mm')} - {format(parseISO(booking.end), 'HH:mm')}
                          </span>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                            <div className="font-semibold text-sm">{booking.projectName}</div>
                            {booking.role && booking.role !== booking.projectName && (
                              <div className="text-gray-300">{booking.role}</div>
                            )}
                            <div className="text-gray-400 mt-1">
                              {format(parseISO(booking.start), 'd MMM HH:mm', { locale: sv })} -{' '}
                              {format(parseISO(booking.end), 'HH:mm', { locale: sv })}
                            </div>
                            {booking.location && (
                              <div className="text-gray-400 flex items-center gap-1 mt-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {booking.location}
                              </div>
                            )}
                            {booking.remark && (
                              <div className="text-gray-400 mt-1 max-w-xs truncate">
                                {booking.remark}
                              </div>
                            )}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {crew.length > 0 && bookings.length === 0 && (
        <div className="p-8 text-center border-t border-gray-100 dark:border-gray-700">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Inga bokningar hittades för vald period.</p>
        </div>
      )}
    </div>
  );
}

export default Timeline;
