import React, { useCallback, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { Film } from '../../types/film';
import { TeamMember } from '../../types/team';
import { IntervalDetail } from '../../hooks/useAlmanacCharts';
import { useMonthOfYearChart } from '../../hooks/useMonthOfYearChart';
import { useMemberTrendsChart } from '../../hooks/useMemberTrendsChart';
import {
    CALENDAR_SHADE_LABELS,
    CalendarShade,
    useCalendarHeatmap,
} from '../../hooks/useCalendarHeatmap';
import { LONG_MONTH_NAMES, MonthFilms, formatLongMonth } from '../../utils/timelineUtils';
import ChartContainer from './ChartContainer';
import CategorySelector from './CategorySelector';
import IntervalDetailDisplay from './IntervalDetailDisplay';
import FilmScoresDetailDisplay from './FilmScoresDetailDisplay';
import AnimatedHeight from '../common/AnimatedHeight';
import Button from '../common/Button';
import Collapse from '../common/Collapse';

export type TimelineChart = 'intervals' | 'monthOfYear' | 'memberTrends' | 'calendar';

const TIMELINE_CHARTS: TimelineChart[] = ['intervals', 'monthOfYear', 'memberTrends', 'calendar'];

const TIMELINE_LABELS: Record<TimelineChart, string> = {
    intervals: 'Meeting Gaps',
    monthOfYear: 'Month of Year',
    memberTrends: 'Member Trends',
    calendar: 'Calendar',
};

const TIMELINE_TITLES: Record<TimelineChart, string> = {
    intervals: 'Time Between Club Meetings',
    monthOfYear: 'Average Score by Month of Year',
    memberTrends: 'Member Scores Over Time',
    calendar: 'The Club Calendar',
};

const TIMELINE_HINTS: Record<TimelineChart, string> = {
    intervals: 'Click on a point to see which film was watched at the end of that interval.',
    monthOfYear:
        'Every year’s films together, by the month they were watched. Click on a month to see them.',
    memberTrends:
        'Each point is a member’s average score for the films watched that month. Click one to see them; click a name to show only that member, then more names to add them.',
    calendar: 'Click on a month to see the films watched in it.',
};

const CALENDAR_SHADES: CalendarShade[] = ['films', 'score'];

const filmsUnit = (count: number): string => `film${count === 1 ? '' : 's'}`;

/** A month's panel figure: its average where it has one, else its film count. */
const monthFigure = (month: MonthFilms): { figure: string; figureUnit: string } => {
    const count = month.films.length;
    return month.average === null
        ? { figure: String(count), figureUnit: filmsUnit(count) }
        : { figure: month.average.toFixed(1), figureUnit: `avg · ${count} ${filmsUnit(count)}` };
};

/**
 * The last value that wasn't null. A panel is closed by clearing its selection
 * at once, but it takes a moment to fold away, and it should fold away showing
 * what it opened with rather than empty.
 */
const useLastOpened = <T,>(value: T | null): T | null => {
    const [last, setLast] = useState(value);
    if (value !== null && value !== last) setLast(value);
    return value ?? last;
};

const Placeholder: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-center py-8 text-slate-400 text-sm">{children}</div>
);

interface TimelineChartsCardProps {
    films: Film[];
    members: TeamMember[];
    meetingIntervalChartOptions: Highcharts.Options;
    meetingIntervalData: Highcharts.PointOptionsObject[];
    selectedIntervalDetail: IntervalDetail | null;
    closeIntervalDetail: () => void;
}

/**
 * The almanac's charts over time, one at a time behind a row of chips, each
 * with the panel a click on it opens underneath.
 */
const TimelineChartsCard: React.FC<TimelineChartsCardProps> = ({
    films,
    members,
    meetingIntervalChartOptions,
    meetingIntervalData,
    selectedIntervalDetail,
    closeIntervalDetail,
}) => {
    const [chart, setChart] = useState<TimelineChart>('intervals');
    const monthly = useMonthOfYearChart(films);
    const trends = useMemberTrendsChart(films, members);
    const calendar = useCalendarHeatmap(films);

    const shownInterval = useLastOpened(selectedIntervalDetail);
    const shownMonth = useLastOpened(monthly.selectedMonth);
    const shownTrendPoint = useLastOpened(trends.selectedPoint);
    const shownCalendarMonth = useLastOpened(calendar.selectedMonth);

    const { closeMonthDetail } = monthly;
    const { closeTrendDetail } = trends;
    const { closeCalendarDetail } = calendar;

    // A point on one chart means nothing on another, so its panel folds away
    // when the chart changes. Picking the chart already showing keeps it.
    const handleSelectChart = useCallback(
        (next: TimelineChart) => {
            if (next === chart) return;
            setChart(next);
            closeIntervalDetail();
            closeMonthDetail();
            closeTrendDetail();
            closeCalendarDetail();
        },
        [chart, closeIntervalDetail, closeMonthDetail, closeTrendDetail, closeCalendarDetail]
    );

    const intervalDays = meetingIntervalData.map((point) => point.y ?? 0);
    const activeMonths = calendar.cells.filter((cell) => cell.month).length;
    const meta: Record<TimelineChart, string | null> = {
        intervals: intervalDays.length
            ? `Avg ${Math.round(intervalDays.reduce((sum, d) => sum + d, 0) / intervalDays.length)} days`
            : null,
        monthOfYear: monthly.filmCount ? `${monthly.filmCount} films` : null,
        memberTrends: trends.trends.length ? `${trends.trends.length} members` : null,
        calendar: calendar.cells.length
            ? `${activeMonths} of ${calendar.cells.length} months`
            : null,
    };

    const hasIntervals =
        ((meetingIntervalChartOptions.series?.[0] as Highcharts.SeriesLineOptions | undefined)?.data
            ?.length ?? 0) > 0;

    const chartBody = (() => {
        switch (chart) {
            case 'intervals':
                return hasIntervals ? (
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={meetingIntervalChartOptions}
                    />
                ) : (
                    <Placeholder>Loading intervals...</Placeholder>
                );
            case 'monthOfYear':
                return monthly.filmCount > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={monthly.chartOptions} />
                ) : (
                    <Placeholder>No scored films yet.</Placeholder>
                );
            case 'memberTrends':
                return trends.trends.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={trends.chartOptions} />
                ) : (
                    <Placeholder>No member has scored a film yet.</Placeholder>
                );
            case 'calendar':
                return calendar.cells.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={calendar.chartOptions} />
                ) : (
                    <Placeholder>No watched films yet.</Placeholder>
                );
        }
    })();

    return (
        <ChartContainer className="mb-8 sm:mb-10" title={TIMELINE_TITLES[chart]} meta={meta[chart]}>
            <CategorySelector
                categories={TIMELINE_CHARTS}
                labels={TIMELINE_LABELS}
                selectedCategory={chart}
                onSelectCategory={handleSelectChart}
            />
            <p className="mb-2 text-center text-xs text-slate-400 mt-3 italic">
                {TIMELINE_HINTS[chart]}
            </p>
            {/* Keyed on the chart so a switch mounts a fresh one and plays its
                intro, and eased between their heights; see the donut above. The
                calendar's shade control rides inside, so it eases in with it. */}
            <AnimatedHeight>
                <div key={chart} className="animate-fade-in">
                    {chart === 'calendar' && calendar.cells.length > 0 && (
                        <div className="mb-1 flex items-center justify-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                Shade by
                            </span>
                            {CALENDAR_SHADES.map((shade) => (
                                <Button
                                    key={shade}
                                    onClick={() => calendar.setShade(shade)}
                                    variant="chip"
                                    size="xs"
                                    active={calendar.shade === shade}
                                    aria-pressed={calendar.shade === shade}
                                >
                                    {CALENDAR_SHADE_LABELS[shade]}
                                </Button>
                            ))}
                        </div>
                    )}
                    {chartBody}
                </div>
            </AnimatedHeight>

            <Collapse
                open={chart === 'intervals' && selectedIntervalDetail !== null}
                innerClassName="mt-4"
            >
                {shownInterval && (
                    <IntervalDetailDisplay detail={shownInterval} onClose={closeIntervalDetail} />
                )}
            </Collapse>

            {/* The panels below can hold a film or several, so a click from one
                point to another eases to the new height. */}
            <Collapse
                open={chart === 'monthOfYear' && monthly.selectedMonth !== null}
                innerClassName="mt-4"
            >
                {shownMonth && shownMonth.average !== null && (
                    <AnimatedHeight>
                        <FilmScoresDetailDisplay
                            label={`${LONG_MONTH_NAMES[shownMonth.monthIndex]} · all years`}
                            figure={shownMonth.average.toFixed(1)}
                            figureUnit={`avg · ${shownMonth.films.length} ${filmsUnit(
                                shownMonth.films.length
                            )}`}
                            films={shownMonth.films}
                            datesWithYear
                            onClose={closeMonthDetail}
                            closeLabel="Close month details"
                        />
                    </AnimatedHeight>
                )}
            </Collapse>

            <Collapse
                open={chart === 'memberTrends' && trends.selectedPoint !== null}
                innerClassName="mt-4"
            >
                {shownTrendPoint && (
                    <AnimatedHeight>
                        <FilmScoresDetailDisplay
                            label={`${shownTrendPoint.trend.name} · ${formatLongMonth(
                                shownTrendPoint.month.month
                            )}`}
                            figure={shownTrendPoint.month.average.toFixed(1)}
                            figureUnit={`avg · ${shownTrendPoint.month.films.length} ${filmsUnit(
                                shownTrendPoint.month.films.length
                            )}`}
                            films={shownTrendPoint.month.films}
                            onClose={closeTrendDetail}
                            closeLabel="Close member month details"
                        />
                    </AnimatedHeight>
                )}
            </Collapse>

            <Collapse
                open={chart === 'calendar' && calendar.selectedMonth !== null}
                innerClassName="mt-4"
            >
                {shownCalendarMonth && (
                    <AnimatedHeight>
                        <FilmScoresDetailDisplay
                            label={formatLongMonth(shownCalendarMonth.month)}
                            {...monthFigure(shownCalendarMonth)}
                            films={shownCalendarMonth.films}
                            onClose={closeCalendarDetail}
                            closeLabel="Close month details"
                        />
                    </AnimatedHeight>
                )}
            </Collapse>
        </ChartContainer>
    );
};

export default TimelineChartsCard;
