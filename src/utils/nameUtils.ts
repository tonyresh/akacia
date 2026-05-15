export const formatNameAbbreviated = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  
  const lastName = parts[0];
  const firstNameInitial = parts[1].charAt(0).toUpperCase();
  const middleNameInitial = parts[2] ? parts[2].charAt(0).toUpperCase() : '';
  
  return `${lastName} ${firstNameInitial}.${middleNameInitial ? middleNameInitial + '.' : ''}`;
};

export const splitNameTwoLines = (fullName: string) => {
  if (!fullName) return { first: '', second: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: fullName, second: '' };
  
  const lastName = parts[0];
  const firstName = parts[1]; // Only take the first name
  
  return { first: lastName, second: firstName };
};
