"use client";
import { useId, useRef, useState } from "react";
import { Search, SlidersHorizontal, Star, EyeOff, X } from "lucide-react";
import {
  type ExerciseSort,
  exerciseEquipmentOptions,
  exerciseMuscleOptions,
} from "@168hours/contracts";
import { ExerciseFilterGroup } from "./exercise-filter-group";
import { FitnessSelect } from "./fitness-select";
import { FilterTagRow } from "./filter-tag-row";
export function ExerciseLibraryControls({
  resultCount,
  hasMore,
  sort,
  onSort,
  search,
  equipment,
  muscle,
  favourites,
  archived,
  allowArchived,
  onSearch,
  onEquipment,
  onMuscle,
  onFavourites,
  onArchived,
  onClear,
}: {
  resultCount: number;
  hasMore: boolean;
  sort: ExerciseSort;
  onSort: (value: ExerciseSort) => void;
  onClear: () => void;
  search: string;
  equipment: string[];
  muscle: string[];
  favourites: boolean;
  archived: boolean;
  allowArchived: boolean;
  onSearch: (value: string) => void;
  onEquipment: (value: string[]) => void;
  onMuscle: (value: string[]) => void;
  onFavourites: (value: boolean) => void;
  onArchived: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const count = equipment.length + muscle.length;
  return (
    <div className="fitness-library-controls">
      <div className="fitness-library-toolbar">
        <label className="fitness-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Find an exercise</span>
          <input
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="fitness-filter-trigger fitness-favourites-toggle"
          aria-label="Favourites"
          aria-pressed={favourites}
          title={favourites ? "Show all exercises" : "Show favourites"}
          onClick={() => onFavourites(!favourites)}
        >
          <Star
            size={18}
            fill={favourites ? "currentColor" : "none"}
            aria-hidden="true"
          />
          <span className="fitness-favourites-label">Favourites</span>
        </button>
        {allowArchived && (
          <button
            type="button"
            className="fitness-filter-trigger fitness-hidden-toggle"
            aria-label="Hidden"
            aria-pressed={archived}
            data-active={archived}
            title="Show hidden built-ins and archived custom exercises"
            onClick={() => onArchived(!archived)}
          >
            <EyeOff size={18} aria-hidden="true" />
            <span>Hidden</span>
          </button>
        )}
        <button
          ref={trigger}
          type="button"
          className="fitness-filter-trigger"
          aria-expanded={open}
          aria-controls={id}
          data-active={count > 0}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filters{" "}
          {count > 0 && <span className="fitness-filter-count">{count}</span>}
        </button>
      </div>
      <div
        className="fitness-filter-reveal"
        data-open={open}
        inert={!open}
        aria-hidden={!open}
      >
        <div className="fitness-filter-reveal-inner">
          <div
            id={id}
            role="region"
            aria-label="Exercise filters"
            className="fitness-filter-panel"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                trigger.current?.focus();
              }
            }}
          >
            <div className="fitness-filter-groups">
              <ExerciseFilterGroup
                label="Equipment"
                options={exerciseEquipmentOptions}
                value={equipment}
                onChange={onEquipment}
              />
              <ExerciseFilterGroup
                label="Muscle group"
                options={exerciseMuscleOptions}
                value={muscle}
                onChange={onMuscle}
              />
              <div className="fitness-filter-sort">
                <FitnessSelect
                  label="Sort exercises"
                  searchable={false}
                  value={sort}
                  onChange={(value) => onSort(value as ExerciseSort)}
                  options={[
                    { value: "name_asc", label: "Name A–Z" },
                    { value: "name_desc", label: "Name Z–A" },
                    { value: "recent", label: "Recently added" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {(count > 0 || favourites || archived || !!search) && (
        <div className="fitness-active-filters">
          <FilterTagRow>
            {(
              [
                ["equipment", equipment, onEquipment],
                ["muscle group", muscle, onMuscle],
              ] as const
            ).map(
              ([label, values, onChange]) =>
                values.length > 0 && (
                  <ul
                    key={label}
                    className="fitness-selection-chips"
                    aria-label={`Selected ${label}`}
                  >
                    {values.map((option) => (
                      <li key={option}>
                        <span>{option}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${option}`}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onChange(values.filter((item) => item !== option));
                            trigger.current?.focus();
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ),
            )}
          </FilterTagRow>
          <div className="fitness-filter-summary">
            <span className="fitness-library-count">
              {resultCount}
              {hasMore ? "+" : ""}{" "}
              {resultCount === 1 && !hasMore ? "exercise" : "exercises"}
            </span>
            <button
              type="button"
              className="fitness-text-action fitness-clear-all"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onClear();
                trigger.current?.focus();
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
