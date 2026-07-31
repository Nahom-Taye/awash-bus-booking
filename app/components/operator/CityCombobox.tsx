"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  OTHER_CITY_VALUE,
  citySearchText,
  type EthiopianCity,
} from "@/lib/ethiopian-cities";

type CityComboboxProps = {
  id: string;
  label: string;
  value: string;
  locale: string;
  options: readonly EthiopianCity[];
  placeholder: string;
  searchPlaceholder: string;
  noResults: string;
  otherLabel?: string;
  onChange: (value: string) => void;
};

export default function CityCombobox({
  id,
  label,
  value,
  locale,
  options,
  placeholder,
  searchPlaceholder,
  noResults,
  otherLabel,
  onChange,
}: CityComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((city) => city.value === value);
  const selectedLabel =
    value === OTHER_CITY_VALUE
      ? otherLabel
      : selected
        ? locale === "am"
          ? selected.am
          : selected.en
        : "";

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? options.filter((city) =>
          citySearchText(city).includes(normalizedQuery),
        )
      : [...options];
  }, [options, query]);

  const menuOptions = otherLabel
    ? [
        ...filteredOptions,
        { value: OTHER_CITY_VALUE, en: otherLabel, am: otherLabel },
      ]
    : filteredOptions;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, Math.max(menuOptions.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && menuOptions[activeIndex]) {
      event.preventDefault();
      choose(menuOptions[activeIndex].value);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label id={`${id}-label`} className="awash-label">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
            return;
          }
          setQuery("");
          setActiveIndex(0);
          setOpen(true);
          queueMicrotask(() => inputRef.current?.focus());
        }}
        className="awash-input flex items-center justify-between gap-3 text-left"
      >
        <span className={selectedLabel ? "text-stone-900" : "text-stone-400"}>
          {selectedLabel || placeholder}
        </span>
        <span aria-hidden="true" className="text-xs text-stone-500">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            aria-controls={`${id}-options`}
            aria-activedescendant={
              menuOptions[activeIndex]
                ? `${id}-option-${activeIndex}`
                : undefined
            }
            className="min-h-10 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-awash-orange focus:ring-3 focus:ring-orange-100"
          />
          <ul
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="mt-2 max-h-60 overflow-y-auto"
          >
            {menuOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-stone-500">
                {noResults}
              </li>
            ) : (
              menuOptions.map((city, index) => (
                <li
                  id={`${id}-option-${index}`}
                  key={city.value}
                  role="option"
                  aria-selected={city.value === value}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(city.value)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange ${
                      index === activeIndex
                        ? "bg-orange-50 text-awash-orange-dark"
                        : "text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span>
                      {city.value === OTHER_CITY_VALUE
                        ? otherLabel
                        : locale === "am"
                          ? city.am
                          : city.en}
                    </span>
                    {city.value === value && (
                      <span aria-hidden="true" className="font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
