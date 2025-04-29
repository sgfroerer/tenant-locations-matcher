
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ColumnSelectorProps {
  headers: string[];
  selectedColumn: string;
  onChange: (column: string) => void;
  label: string;
  disabled?: boolean;
  placeholder?: string;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  headers,
  selectedColumn,
  onChange,
  label,
  disabled = false,
  placeholder = "Select column"
}) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <Select
        value={selectedColumn}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">None</SelectItem>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ColumnSelector;
