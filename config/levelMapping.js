// config/levelMapping.js

/**
 * Maps each level (1-14) to ranks per department.
 * Departments: Army, Marine, Naval
 */
module.exports = {
  1:  { Army: 'Private',                  Marine: 'Private',                 Naval: 'Seaman Recruit' },
  2:  { Army: 'Private Second Class',     Marine: 'Private First Class',    Naval: 'Seaman Apprentice' },
  3:  { Army: 'Private First Class',      Marine: 'Lance Corporal',         Naval: 'Seaman' },
  4:  { Army: 'Corporal',                  Marine: 'Corporal',               Naval: 'Petty Officer Third Class' },
  5:  { Army: 'Sergeant',                  Marine: 'Sergeant',               Naval: 'Petty Officer Second Class' },
  6:  { Army: 'Staff Sergeant',            Marine: 'Staff Sergeant',         Naval: 'Petty Officer First Class' },
  7:  { Army: 'Sergeant First Class',     Marine: 'Gunnery Sergeant',       Naval: 'Chief Petty Officer' },
  8:  { Army: 'Master Sergeant',           Marine: 'First Sergeant',         Naval: 'Senior Chief Petty Officer' },
  9:  { Army: 'Sergeant Major',            Marine: 'Master Gunnery Sergeant',Naval: 'Master Chief Petty Officer' },
  10: { Army: 'Warrant Officer 1',         Marine: 'Warrant Officer 1',      Naval: 'Warrant Officer 1' },
  11: { Army: 'Chief Warrant Officer 2',   Marine: 'Chief Warrant Officer 2',Naval: 'Chief Warrant Officer 2' },
  12: { Army: 'Chief Warrant Officer 3',   Marine: 'Chief Warrant Officer 3',Naval: 'Chief Warrant Officer 3' },
  13: { Army: 'Chief Warrant Officer 4',   Marine: 'Chief Warrant Officer 4',Naval: 'Chief Warrant Officer 4' },
  14: { Army: 'Chief Warrant Officer 5',   Marine: 'Chief Warrant Officer 5',Naval: 'Chief Warrant Officer 5' },
};