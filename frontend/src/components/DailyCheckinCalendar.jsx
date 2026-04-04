import React, { useEffect, useState } from "react";
import {
  getWeekdays,
  getShortMonthName,
  getDaysInWeeksInMonth,
} from "./getDaysInWeeksInMonth";

const pad2 = (n) => String(n).padStart(2, "0");

function toISO({ year, month, day }) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseISO(iso) {
  if (!iso || typeof iso !== "string") return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

const dayStyle = {
  borderRadius: "50%",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  height: 30,
  width: 30,
  transition: "background-color .2s ease-out",
};

const today = new Date();
const initialState = {
  year: today.getFullYear(),
  month: today.getMonth(),
  day: today.getDate(),
};

/**
 * Month arrows only change the visible month; `onChange` runs when the user picks a day or Today.
 *
 * @param {object} props
 * @param {string} props.value - YYYY-MM-DD
 * @param {(iso: string) => void} props.onChange
 * @param {string} [props.accentColor] — selected day and “today” ring/fill (same green)
 */
export default function DailyCheckinCalendar({ value, onChange, accentColor = "#16a34a" }) {
  const selected = parseISO(value) || { ...initialState };
  const [view, setView] = useState(() => {
    const p = parseISO(value);
    return p ? { year: p.year, month: p.month } : { year: initialState.year, month: initialState.month };
  });

  useEffect(() => {
    const p = parseISO(value);
    if (p) {
      setView({ year: p.year, month: p.month });
    }
  }, [value]);

  const previousMonth = () => {
    setView(({ year, month }) => ({
      year: month > 0 ? year : year - 1,
      month: month > 0 ? month - 1 : 11,
    }));
  };

  const nextMonth = () => {
    setView(({ year, month }) => ({
      year: month === 11 ? year + 1 : year,
      month: month === 11 ? 0 : month + 1,
    }));
  };

  const selectDay = ({ currentTarget }) => {
    const { day, month, year } = currentTarget.dataset;
    const next = {
      year: Number(year),
      month: Number(month),
      day: Number(day),
    };
    if (onChange) {
      onChange(toISO(next));
    }
  };

  const setToday = () => {
    const next = { ...initialState };
    if (onChange) {
      onChange(toISO(next));
    }
  };

  const now = new Date();

  return (
    <table
      role="grid"
      style={{
        backgroundColor: "#fefcfc",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        width: "100%",
        maxWidth: 360,
        margin: 0,
      }}
    >
      <caption
        style={{
          color: accentColor,
          padding: "0.75rem 0.25rem 1rem",
          fontWeight: 700,
          userSelect: "none",
          captionSide: "top",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span onClick={previousMonth} style={{ cursor: "pointer", padding: "0 4px" }} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && previousMonth()}>
            ❮
          </span>
          <span>{`${getShortMonthName(view.month)} ${view.year}`}</span>
          <span onClick={nextMonth} style={{ cursor: "pointer", padding: "0 4px" }} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nextMonth()}>
            ❯
          </span>
        </div>
      </caption>

      <thead
        style={{
          borderBottom: "1px solid #e1e1e1",
        }}
      >
        <tr>
          {getWeekdays().map((d, i) => {
            const isWeekend = i > 4;
            const weekendStyle = { color: "#a4a4a4" };
            return (
              <th
                key={d}
                scope="col"
                role="columnheader"
                aria-label={d}
                style={{
                  fontSize: 10,
                  paddingBottom: 5,
                  ...(isWeekend ? weekendStyle : {}),
                }}
              >
                {d.charAt(0)}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>
        {getDaysInWeeksInMonth(view.year, view.month).map((w, wi) => (
          <tr
            key={`week_${wi}`}
            style={{
              borderBottom: "1px solid #e1e1e1",
            }}
          >
            {w.map((d, di) => {
              const isToday =
                d > 0 &&
                d === now.getDate() &&
                view.month === now.getMonth() &&
                view.year === now.getFullYear();
              const isSelectedDay =
                d > 0 &&
                selected.year === view.year &&
                selected.month === view.month &&
                selected.day === d;
              const isWeekend = di > 4;
              const weekendStyle = { color: "#a4a4a4" };

              let spanStyle = { ...dayStyle, ...(isWeekend ? weekendStyle : {}) };
              if (d <= 0) {
                spanStyle = { ...spanStyle, visibility: "hidden", pointerEvents: "none" };
              } else if (isToday && isSelectedDay) {
                spanStyle = {
                  ...spanStyle,
                  color: "#fff",
                  backgroundColor: accentColor,
                  fontWeight: 600,
                };
              } else if (isSelectedDay) {
                spanStyle = {
                  ...spanStyle,
                  color: "#fff",
                  backgroundColor: accentColor,
                  fontWeight: 600,
                };
              } else if (isToday && !isSelectedDay) {
                spanStyle = {
                  ...spanStyle,
                  color: accentColor,
                  fontWeight: 600,
                  boxShadow: `inset 0 0 0 2px ${accentColor}`,
                };
              }

              return (
                <td
                  key={`day_${wi}_${di}`}
                  style={{
                    padding: "0.35rem 0.25rem",
                    position: "relative",
                    textAlign: "center",
                  }}
                >
                  {d > 0 ? (
                    <span
                      role="gridcell"
                      tabIndex={0}
                      onClick={selectDay}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectDay({ currentTarget: e.currentTarget });
                        }
                      }}
                      data-day={d}
                      data-month={view.month}
                      data-year={view.year}
                      style={spanStyle}
                    >
                      {d}
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", width: 30, height: 30 }} aria-hidden />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>

      <tfoot>
        <tr>
          <td colSpan={7} style={{ color: accentColor, cursor: "pointer", fontWeight: 600, fontSize: 13, paddingTop: "0.75rem", paddingBottom: "0.25rem" }} onClick={setToday}>
            Today
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
