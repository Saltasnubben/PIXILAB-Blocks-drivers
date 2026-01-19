import Select from 'react-select';

function CrewSelector({ crew, selected, onChange, loading }) {
  const options = crew.map(member => ({
    value: member.id,
    label: member.name,
    data: member
  }));

  const selectedOptions = selected.map(member => ({
    value: member.id,
    label: member.name,
    data: member
  }));

  const handleChange = (newValue) => {
    const selectedMembers = newValue
      ? newValue.map(option => option.data)
      : [];
    onChange(selectedMembers);
  };

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '44px',
      borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: '#3b82f6'
      }
    }),
    multiValue: (base, { data }) => ({
      ...base,
      backgroundColor: data.data?.color ? `${data.data.color}20` : '#dbeafe',
      borderRadius: '6px'
    }),
    multiValueLabel: (base, { data }) => ({
      ...base,
      color: data.data?.color || '#1e40af',
      fontWeight: 500
    }),
    multiValueRemove: (base, { data }) => ({
      ...base,
      color: data.data?.color || '#1e40af',
      ':hover': {
        backgroundColor: data.data?.color ? `${data.data.color}40` : '#bfdbfe',
        color: '#1e3a8a'
      }
    }),
    option: (base, { isSelected, isFocused }) => ({
      ...base,
      backgroundColor: isSelected
        ? '#3b82f6'
        : isFocused
        ? '#eff6ff'
        : 'white',
      color: isSelected ? 'white' : '#1f2937',
      cursor: 'pointer'
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9ca3af'
    })
  };

  const formatOptionLabel = ({ label, data }) => (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: data?.color || '#3b82f6' }}
      />
      <span>{label}</span>
      {data?.function && (
        <span className="text-xs text-gray-400 ml-auto">{data.function}</span>
      )}
    </div>
  );

  return (
    <Select
      isMulti
      options={options}
      value={selectedOptions}
      onChange={handleChange}
      isLoading={loading}
      placeholder="Sök och välj crewmedlemmar..."
      noOptionsMessage={() => 'Inga crewmedlemmar hittades'}
      loadingMessage={() => 'Laddar...'}
      styles={customStyles}
      formatOptionLabel={formatOptionLabel}
      closeMenuOnSelect={false}
      className="crew-selector"
      classNamePrefix="crew-select"
    />
  );
}

export default CrewSelector;
