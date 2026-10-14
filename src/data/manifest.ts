// Static imports of the authored data.
//
// The app reads its notes through this module rather than by listing a directory, so nothing
// in the request path touches the filesystem and the deployed bundle stays small. The
// manifest is checked against the contents of data/notes/ by a test, so the two cannot drift.

import key from '../../data/key.json';
import n01 from '../../data/notes/n01.json';
import n02 from '../../data/notes/n02.json';
import n03 from '../../data/notes/n03.json';
import n04 from '../../data/notes/n04.json';
import n05 from '../../data/notes/n05.json';
import n06 from '../../data/notes/n06.json';
import n07 from '../../data/notes/n07.json';
import n08 from '../../data/notes/n08.json';
import n09 from '../../data/notes/n09.json';
import n10 from '../../data/notes/n10.json';
import n11 from '../../data/notes/n11.json';
import n12 from '../../data/notes/n12.json';
import n13 from '../../data/notes/n13.json';
import n14 from '../../data/notes/n14.json';
import n15 from '../../data/notes/n15.json';
import n16 from '../../data/notes/n16.json';
import n17 from '../../data/notes/n17.json';
import n18 from '../../data/notes/n18.json';
import n19 from '../../data/notes/n19.json';
import n20 from '../../data/notes/n20.json';
import n21 from '../../data/notes/n21.json';
import n22 from '../../data/notes/n22.json';
import n23 from '../../data/notes/n23.json';
import n24 from '../../data/notes/n24.json';
import n25 from '../../data/notes/n25.json';
import n26 from '../../data/notes/n26.json';
import n27 from '../../data/notes/n27.json';
import n28 from '../../data/notes/n28.json';
import n29 from '../../data/notes/n29.json';
import n30 from '../../data/notes/n30.json';

export const RAW_NOTES: unknown[] = [
  n01,
  n02,
  n03,
  n04,
  n05,
  n06,
  n07,
  n08,
  n09,
  n10,
  n11,
  n12,
  n13,
  n14,
  n15,
  n16,
  n17,
  n18,
  n19,
  n20,
  n21,
  n22,
  n23,
  n24,
  n25,
  n26,
  n27,
  n28,
  n29,
  n30,
];

export const RAW_KEY: unknown = key;
