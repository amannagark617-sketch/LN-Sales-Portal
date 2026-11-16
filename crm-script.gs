var SALE_REPORT_ID = '1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU';
var LEAD_SHEET_ID = '13DxQgqHFYXd2YIQ6eO0uscJ_LOENpRw59msxk5cIg4U';
var LEAD_SHEET_GID = 1382477988;
var APP_PREFIX = 'LNS';
var SELF_TAB = 'Self Leads';
var SELF_COLS = ['Enquiry No', 'Date', 'Added By', 'Added By ID', 'Source', 'Segment', 'Title', 'First Name', 'Last Name', 'Company', 'Designation', 'Phone', 'Email', 'City', 'State', 'Zone', 'Requirement', 'Quantity', 'Notes'];
var FIRST_CALL_CUTOFF = '18:30';
var MAX_PER_RUN = 60;

var LEAD_COLS = ['enquiryNo', 'createdAt', 'channel', 'sourceRef', 'source', 'group', 'segment', 'title', 'firstName', 'lastName',
  'company', 'designation', 'phone', 'phoneKey', 'email', 'city', 'state', 'zone', 'requirement', 'quantity', 'notes',
  'utmMedium', 'utmCampaign', 'addedBy', 'ownerId', 'ownerName', 'ownerTeam', 'nbdId', 'nbdName', 'stage', 'outcome',
  'reason', 'nextFollowUp', 'meetingDate', 'meetingTime', 'opf', 'orderValue', 'updatedAt', 'salesId', 'salesName', 'altPhone'];
var TL_COLS = ['time', 'enquiryNo', 'byId', 'byName', 'type', 'text', 'nextFollowUp', 'fromName', 'toName'];
var QUOTE_COLS = ['enquiryNo', 'quoteNo', 'docType', 'brand', 'amount', 'linkedQuote', 'byId', 'byName', 'date'];
var PA_COLS = ['enquiryNo', 'step', 'owner', 'planned', 'actual', 'delayMinutes'];
var LISTS = {
  Source: [
    ['Meta', 'NBD'], ['Google', 'NBD'], ['Google Search', 'NBD'], ['Google Demand Gen', 'NBD'], ['Website', 'NBD'], ['WhatsApp BOT', 'NBD'],
    ['WhatsApp (Marketing Department)', 'NBD'], ['Popin', 'NBD'], ['IVR', 'NBD'], ['Facebook', 'NBD'], ['Instagram', 'NBD'], ['Linkedin', 'NBD'],
    ['Youtube', 'NBD'], ['Social Media', 'NBD'], ['Just dial', 'NBD'], ['Indiamart', 'NBD'], ['TWAK Chat', 'NBD'],
    ['Walk-In', 'Direct'], ['Reference', 'Direct'], ['Old Client', 'Direct'], ['Architect', 'Direct'], ['Interior Designer', 'Direct'],
    ['AV Dealer', 'Direct'], ['New AV-Partner', 'Direct'], ['New AV-Partner(Enquires)', 'Direct'], ['Furniture Dealer', 'Direct'],
    ['Franchise', 'Direct'], ['OEM', 'Direct'], ['SIS', 'Direct'], ['CRR', 'Direct'], ['Exhibition', 'Direct'], ['Smart Home Expo', 'Direct'],
    ['Big Cine Expo', 'Direct'], ['Ace Reflect Exhibition', 'Direct'], ['IMAARAT Design Festival-2025', 'Direct'], ['Bharat Buildcon', 'Direct'],
    ['What Hi-Fi', 'Direct'], ['La-Z-Boy', 'Direct'], ['RS Sir', 'Direct'], ['Manoj Bindal', 'Direct'], ['Myself', 'Direct'], ['Others', 'Direct']
  ],
  Segment: ['Retail', 'Online', 'Project', 'AV Dealers', 'Furniture Dealer', 'Franchise', 'For New Franchise', 'SIS', 'Exhibition', 'Popin'],
  Title: ['Mr.', 'Ms.', 'Mrs.', 'Dr.'],
  Designation: ['Director', 'CEO', 'GM', 'Purchase Head', 'Project Manager', 'Other'],
  Requirement: ['Living room recliner', 'Home theater recliners', 'Slider', 'Massage chair', 'Massage accessories', 'Seating spectrum chair', 'La-Z-Boy',
    'Stressle', 'Cinema', 'Club House', 'Hospital', 'Work From Home', 'NA'],
  Zone: ['North', 'South', 'West', 'East'],
  State: ['Andhra Pradesh', 'Andaman and Nicobar Islands', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
    'Dadra & Nagar Haveli and Daman & Diu', 'Delhi/NCR', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
    'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Nepal', 'Odisha', 'Puducherry',
    'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Oman'],
  LostReason: ['Price too high', 'Bought elsewhere', 'Not interested now', 'Not reachable', 'Postponed', 'Wrong requirement', 'Other'],
  InvalidReason: ['Wrong number', 'Fake or test enquiry', 'Not a customer (job, vendor, spam)', 'Duplicate', 'Outside service area', 'Other']
};
var STAGES = ['New', 'Not connected', 'Follow-up', '1st meeting', 'Send proposal', 'Negotiation', 'Converted'];
var SALES_STAGES = ['1st meeting', 'Send proposal', 'Negotiation'];
var OLD_STAGES = { 'Contacted': 'Follow-up', 'Valid': 'Follow-up', 'Meeting': '1st meeting', 'Proposal': 'Send proposal' };
var LOG_TYPES = ['Call', 'Note', 'Follow-up', 'WhatsApp', 'Meeting', 'Telephonic', 'Client Visit', 'Showroom', 'Video Call'];
var SCHEMA = '4';

function normStage_(s) { s = str_(s); return OLD_STAGES[s] || s; }

function schema_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SCHEMA') === SCHEMA) return;
  ensureTabs_();
  props.setProperty('SCHEMA', SCHEMA);
}

function plannedCall_(from) {
  var t = String(from || now_());
  var day = t.slice(0, 10);
  if (t.slice(11, 16) > FIRST_CALL_CUTOFF) {
    var d = new Date(day + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    day = d.toISOString().slice(0, 10);
  }
  return day + ' ' + FIRST_CALL_CUTOFF;
}

var ZONE_OF_STATE = {
  'Delhi/NCR': 'North', 'Haryana': 'North', 'Punjab': 'North', 'Himachal Pradesh': 'North', 'Jammu and Kashmir': 'North', 'Ladakh': 'North',
  'Chandigarh': 'North', 'Uttar Pradesh': 'North', 'Uttarakhand': 'North', 'Rajasthan': 'North',
  'Maharashtra': 'West', 'Gujarat': 'West', 'Goa': 'West', 'Madhya Pradesh': 'West', 'Chhattisgarh': 'West',
  'Dadra & Nagar Haveli and Daman & Diu': 'West',
  'Karnataka': 'South', 'Kerala': 'South', 'Tamil Nadu': 'South', 'Telangana': 'South', 'Andhra Pradesh': 'South',
  'Puducherry': 'South', 'Lakshadweep': 'South', 'Andaman and Nicobar Islands': 'South',
  'West Bengal': 'East', 'Odisha': 'East', 'Bihar': 'East', 'Jharkhand': 'East', 'Assam': 'East', 'Sikkim': 'East',
  'Arunachal Pradesh': 'East', 'Manipur': 'East', 'Meghalaya': 'East', 'Mizoram': 'East', 'Nagaland': 'East', 'Tripura': 'East'
};
var CITY_ALIAS = {
  'delhi': 'Delhi/NCR', 'new delhi': 'Delhi/NCR', 'ncr': 'Delhi/NCR', 'noida': 'Delhi/NCR', 'greater noida': 'Delhi/NCR',
  'ghaziabad': 'Delhi/NCR', 'faridabad': 'Delhi/NCR', 'gurgaon': 'Delhi/NCR', 'gurugram': 'Delhi/NCR',
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'hyderabad': 'Telangana', 'chennai': 'Tamil Nadu',
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'ahmedabad': 'Gujarat', 'kolkata': 'West Bengal'
};

function setup() {
  ensureTabs_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CRM_KEY')) props.setProperty('CRM_KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  if (!props.getProperty('START_DATE')) props.setProperty('START_DATE', Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'));
  buildCityMap();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncOnlineLeads').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('hourlyMaintenance').timeBased().everyHours(1).create();
  SpreadsheetApp.getActive().toast('CRM ready. Copy CRM_KEY from Project Settings > Script properties.', 'Little Nap CRM', 10);
}

function ensureTabs_() {
  var ss = SpreadsheetApp.getActive();
  [['Leads', LEAD_COLS], ['Timeline', TL_COLS], ['PlannedActual', PA_COLS], ['Quotes', QUOTE_COLS], ['Availability', ['id', 'present', 'updatedAt']], ['CityMap', ['city', 'state']]]
    .forEach(function (d) {
      var sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
      if (sh.getMaxColumns() < d[1].length) sh.insertColumnsAfter(sh.getMaxColumns(), d[1].length - sh.getMaxColumns());
      if (sh.getRange(1, 1).getValue() !== d[1][0] || sh.getRange(1, d[1].length).getValue() !== d[1][d[1].length - 1]) {
        sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      sh.getRange(1, 1, sh.getMaxRows(), d[1].length).setNumberFormat('@');
    });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}

function buildCityMap() {
  var src = SpreadsheetApp.openById(SALE_REPORT_ID).getSheetByName('Data');
  if (!src) return;
  var vals = src.getDataRange().getValues();
  var hr = -1, ci = -1, si = -1;
  for (var r = 0; r < Math.min(5, vals.length); r++) {
    var c = vals[r].indexOf('City'), s = vals[r].indexOf('State');
    if (c >= 0 && s >= 0) { hr = r; ci = c; si = s; break; }
  }
  if (hr < 0) return;
  var seen = {}, out = [];
  for (var i = hr + 1; i < vals.length; i++) {
    var city = String(vals[i][ci] || '').trim(), st = String(vals[i][si] || '').trim();
    if (!city || !st) continue;
    var k = city.toLowerCase();
    if (!seen[k]) { seen[k] = 1; out.push([city, st]); }
  }
  var sh = SpreadsheetApp.getActive().getSheetByName('CityMap');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, 2).setValues(out);
}

function tz_() { return Session.getScriptTimeZone() || 'Asia/Kolkata'; }
function now_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function phoneKey_(p) { var d = String(p || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; }
function parsePlanned_(s) {
  s = str_(s); if (!s) return null;
  if (s.length === 10) s += ' 23:59:59';
  var d = new Date(s.replace(' ', 'T') + '+05:30');
  return isNaN(d.getTime()) ? null : d;
}
function tab_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function jsonOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { schema_(); return fn(); } finally { lock.releaseLock(); }
}

function appendRow_(sh, values) {
  var row = sh.getLastRow() + 1;
  if (row > sh.getMaxRows()) {
    sh.insertRowsAfter(sh.getMaxRows(), 1000);
    sh.getRange(row, 1, 1000, values.length).setNumberFormat('@');
  }
  sh.getRange(row, 1, 1, values.length).setValues([values]);
}

function readLeads_() {
  var sh = tab_('Leads'), n = sh.getLastRow();
  if (n < 2) return [];
  var vals = sh.getRange(2, 1, n - 1, LEAD_COLS.length).getValues();
  return vals.map(function (row, i) {
    var o = { _row: i + 2 };
    LEAD_COLS.forEach(function (c, j) { o[c] = str_(row[j]); });
    o.stage = normStage_(o.stage);
    return o;
  });
}
function writeLead_(lead) {
  var row = LEAD_COLS.map(function (c) { return lead[c] === undefined ? '' : lead[c]; });
  tab_('Leads').getRange(lead._row, 1, 1, LEAD_COLS.length).setValues([row]);
}
function appendLead_(lead) {
  var row = LEAD_COLS.map(function (c) { return lead[c] === undefined ? '' : lead[c]; });
  appendRow_(tab_('Leads'), row);
}
function addTimeline_(enq, by, type, text, nextFollowUp, fromName, toName) {
  var row = [now_(), enq, str_(by && by.id), str_(by && by.name), type, text || '', nextFollowUp || '', fromName || '', toName || ''];
  appendRow_(tab_('Timeline'), row);
}

function closeOpenStep_(enq) {
  var sh = tab_('PlannedActual'), n = sh.getLastRow();
  if (n < 2) return;
  var hits = sh.getRange(2, 1, n - 1, 1).createTextFinder(enq).matchEntireCell(true).findAll();
  var actual = now_(), a = new Date();
  for (var i = hits.length - 1; i >= 0; i--) {
    var r = hits[i].getRow();
    var rowVals = sh.getRange(r, 1, 1, PA_COLS.length).getValues()[0];
    if (!str_(rowVals[4])) {
      var p = parsePlanned_(rowVals[3]);
      var delay = p ? Math.round((a.getTime() - p.getTime()) / 60000) : '';
      sh.getRange(r, 5, 1, 2).setValues([[actual, delay]]);
    }
  }
}
function openStep_(enq, step, ownerName, planned) {
  appendRow_(tab_('PlannedActual'), [enq, step, ownerName || '', planned || '', '', '']);
}

function readLists_() {
  var out = {};
  Object.keys(LISTS).forEach(function (k) {
    out[k] = k === 'Source' ? LISTS[k].map(function (v) { return { name: v[0], group: v[1] }; }) : LISTS[k].slice();
  });
  return out;
}
function groupOf_(source) {
  var s = str_(source).toLowerCase(), list = readLists_().Source;
  for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === s) return list[i].group;
  return 'NBD';
}

function readTeam_() {
  var sh = SpreadsheetApp.openById(SALE_REPORT_ID).getSheetByName('ID Password');
  var vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 11).getValues();
  var out = [];
  vals.forEach(function (r) {
    var id = str_(r[3]);
    if (!id) return;
    out.push({
      region: str_(r[0]), showroom: str_(r[1]), name: str_(r[2]), id: id, mobile: str_(r[7]), email: str_(r[8]),
      team: str_(r[9]), active: str_(r[10]).toLowerCase() !== 'no'
    });
  });
  return out;
}
function memberById_(team, id) { for (var i = 0; i < team.length; i++) if (team[i].id === id) return team[i]; return null; }

function availability_() {
  var sh = tab_('Availability'), n = sh.getLastRow(), map = {};
  if (n < 2) return map;
  sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) { map[str_(r[0])] = str_(r[1]).toLowerCase() !== 'no'; });
  return map;
}
function setAvailable_(id, present) {
  var sh = tab_('Availability'), n = sh.getLastRow();
  var row = 0;
  if (n >= 2) {
    var ids = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (str_(ids[i][0]) === id) { row = i + 2; break; }
  }
  if (!row) row = n + 1;
  sh.getRange(row, 1, 1, 3).setValues([[id, present ? 'Yes' : 'No', now_()]]);
}

function pickNbd_(team, excludeId) {
  var avail = availability_();
  var list = team.filter(function (m) { return m.team === 'NBD' && m.active && avail[m.id] !== false && m.id !== excludeId; });
  if (!list.length) return null;
  list.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  var props = PropertiesService.getScriptProperties();
  var last = props.getProperty('RR_LAST') || '';
  var pick = list[0];
  for (var i = 0; i < list.length; i++) if (list[i].id > last) { pick = list[i]; break; }
  props.setProperty('RR_LAST', pick.id);
  return pick;
}

function setOwner_(lead, m) {
  lead.ownerId = m ? m.id : '';
  lead.ownerName = m ? m.name : '';
  lead.ownerTeam = m ? m.team : '';
  if (m && m.team === 'NBD') { lead.nbdId = m.id; lead.nbdName = m.name; }
}

function nextEnquiryNo_() {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('ENQ_APP') || '0') + 1;
  props.setProperty('ENQ_APP', String(n));
  return APP_PREFIX + '-' + (n < 10 ? '0' + n : String(n));
}

function loadCityMap_() {
  var sh = tab_('CityMap'), n = sh.getLastRow(), map = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) { map[str_(r[0]).toLowerCase()] = str_(r[1]); });
  return map;
}
function matchLocation_(text, cityMap) {
  var t = str_(text).toLowerCase();
  var out = { state: '', zone: '' };
  if (!t) return out;
  var parts = t.split(/[,\/\-|]/).map(function (x) { return x.trim(); }).filter(Boolean);
  var states = Object.keys(ZONE_OF_STATE);
  for (var i = 0; i < parts.length && !out.state; i++) {
    if (CITY_ALIAS[parts[i]]) out.state = CITY_ALIAS[parts[i]];
    else if (cityMap[parts[i]]) out.state = cityMap[parts[i]];
  }
  for (var j = 0; j < parts.length && !out.state; j++)
    for (var k = 0; k < states.length; k++) if (states[k].toLowerCase() === parts[j]) { out.state = states[k]; break; }
  if (!out.state) {
    var words = t.split(/[^a-z]+/).filter(Boolean);
    for (var w = 0; w < words.length && !out.state; w++) {
      if (CITY_ALIAS[words[w]]) out.state = CITY_ALIAS[words[w]];
      else if (cityMap[words[w]]) out.state = cityMap[words[w]];
    }
  }
  out.zone = ZONE_OF_STATE[out.state] || '';
  return out;
}

function newLead_(f, team, how) {
  var cityMap = loadCityMap_();
  var loc = matchLocation_(f.city, cityMap);
  var lead = {
    enquiryNo: f.enquiryNo || nextEnquiryNo_(), createdAt: f.createdAt || now_(), channel: f.channel, sourceRef: str_(f.sourceRef), source: str_(f.source),
    group: f.group || 'NBD', segment: str_(f.segment), title: str_(f.title), firstName: str_(f.firstName), lastName: str_(f.lastName),
    company: str_(f.company), designation: str_(f.designation), phone: str_(f.phone), phoneKey: phoneKey_(f.phone),
    email: str_(f.email), city: str_(f.city), state: str_(f.state) || loc.state, zone: str_(f.zone) || loc.zone,
    requirement: str_(f.requirement), quantity: str_(f.quantity), notes: str_(f.notes), utmMedium: str_(f.utmMedium),
    utmCampaign: str_(f.utmCampaign), addedBy: str_(f.addedByName), ownerId: '', ownerName: '', ownerTeam: '', nbdId: '', nbdName: '',
    stage: 'New', outcome: 'Open', reason: '', nextFollowUp: '', meetingDate: '', meetingTime: '', opf: '', orderValue: '', updatedAt: now_()
  };
  var adder = f.addedBy ? memberById_(team, f.addedBy) : null;
  var owner = null;
  if (adder && adder.active && (adder.team === 'NBD' || (adder.team === 'Sales' && lead.group === 'Direct'))) {
    owner = adder;
    if (adder.team === 'Sales') { lead.stage = '1st meeting'; lead.salesId = adder.id; lead.salesName = adder.name; }
    else { lead.stage = 'Follow-up'; lead.group = 'NBD'; lead.channel = 'NBD team'; }
  } else {
    owner = pickNbd_(team);
  }
  setOwner_(lead, owner);
  lead.nextFollowUp = lead.stage === 'New' ? (owner ? plannedCall_(lead.createdAt) : '') : (str_(f.nextFollowUp) || today_());
  appendLead_(lead);
  addTimeline_(lead.enquiryNo, adder, 'Created', 'Added from ' + (lead.source || lead.channel) + (how ? '. ' + how : ''), '', '', lead.ownerName);
  if (owner) {
    openStep_(lead.enquiryNo, lead.stage === 'New' ? 'First call' : lead.stage, owner.name, lead.nextFollowUp + (lead.nextFollowUp.length === 10 ? ' 18:00:00' : ':00'));
  } else {
    addTimeline_(lead.enquiryNo, null, 'Waiting', 'No NBD person available. First in line for the next one present.', '', '', '');
  }
  return lead;
}

function isTestLead_(name, phone, email) {
  var d = String(phone || '').replace(/\D/g, '');
  if (d === '1234567890' || /^(\d)\1{9}$/.test(d)) return true;
  if (/@littlenap\.in$/i.test(str_(email))) return true;
  if (/^(test|asdf|qwe|abc)/i.test(str_(name))) return true;
  return false;
}

function parseDetectedTime_(v) {
  var d = '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm:ss');
  if (typeof v === 'number') return Utilities.formatDate(new Date(Math.round((v - 25569) * 86400000)), 'UTC', 'yyyy-MM-dd HH:mm:ss');
  var t = str_(v);
  d = parseDetected_(t);
  if (!d) return '';
  var m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(t);
  return d + ' ' + (m ? ('0' + m[1]).slice(-2) + ':' + m[2] + ':' + (m[3] || '00') : '00:00:00');
}

function parseDetected_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  if (typeof v === 'number') return Utilities.formatDate(new Date(Math.round((v - 25569) * 86400000)), 'UTC', 'yyyy-MM-dd');
  var t = str_(v);
  if (/^\d{5}(\.\d+)?$/.test(t)) return parseDetected_(Number(t));
  var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(t);
  if (m) {
    var mon = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }[m[2].toLowerCase()];
    return mon ? m[3] + '-' + mon + '-' + ('0' + m[1]).slice(-2) : '';
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(t);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function feedCols_(headerRow) {
  var map = {};
  headerRow.forEach(function (h, i) { map[str_(h).toLowerCase()] = i; });
  function c(name) { return map[name.toLowerCase()]; }
  var cols = {
    enq: c('Enquiry ID'), type: c('Lead Type'), id: c('ID'), name: c('Name'), email: c('Email'), phone: c('Phone'), loc: c('Location'),
    product: c('Product Detail'), src: c('UTM Source'), med: c('UTM Medium'), camp: c('UTM Campaign'), details: c('Details'),
    also: c('Also Filled'), status: c('Status'), dupOf: c('Duplicate Of'), detected: c('Detected At'), key: c('Key')
  };
  ['enq', 'name', 'phone', 'detected'].forEach(function (k) { if (cols[k] === undefined) throw new Error('Lead sheet is missing the column for ' + k); });
  return cols;
}

function syncOnlineLeads() {
  withLock_(function () {
    var props = PropertiesService.getScriptProperties();
    var startDate = props.getProperty('START_DATE') || today_();
    var src = SpreadsheetApp.openById(LEAD_SHEET_ID).getSheets().filter(function (s) { return s.getSheetId() === LEAD_SHEET_GID; })[0];
    if (!src) return;
    var lastRow = src.getLastRow();
    var done = Number(props.getProperty('FEED_ROW') || '1');
    if (lastRow > done) {
      var width = src.getLastColumn();
      var C = feedCols_(src.getRange(1, 1, 1, width).getValues()[0]);
      var vals = src.getRange(2, 1, lastRow - 1, width).getValues();
      var team = readTeam_();
      var leads = readLeads_();
      var byPhone = {}, bySource = {};
      leads.forEach(function (l) {
        if (l.phoneKey) (byPhone[l.phoneKey] = byPhone[l.phoneKey] || []).push(l);
        if (l.sourceRef) bySource[l.sourceRef] = l.enquiryNo;
      });
      var enqOfKey = {};
      vals.forEach(function (r) {
        var k = C.key !== undefined ? str_(r[C.key]) : '', e = str_(r[C.enq]);
        if (k && e) enqOfKey[k] = e;
        if (C.id !== undefined && str_(r[C.id]) && e) enqOfKey['L-' + str_(r[C.id])] = e;
      });
      var handled = 0;
      for (var i = done - 1; i < vals.length && handled < MAX_PER_RUN; i++) {
        var r = vals[i];
        var enq = str_(r[C.enq]);
        if (!enq) break;
        var key = (C.key !== undefined && str_(r[C.key])) || (C.id !== undefined ? 'L-' + str_(r[C.id]) : enq);
        var detected = parseDetected_(r[C.detected]);
        var rowNo = i + 2;
        props.setProperty('FEED_ROW', String(rowNo));
        handled++;
        if (!detected || detected < startDate) continue;
        if (bySource[key] || leads.some(function (l) { return l.enquiryNo === enq; })) continue;
        var phone = str_(r[C.phone]), name = str_(r[C.name]), email = C.email !== undefined ? str_(r[C.email]) : '';
        var source = (C.src !== undefined && str_(r[C.src])) || 'Website';
        var typ = C.type !== undefined ? str_(r[C.type]) : '';
        var status = C.status !== undefined ? str_(r[C.status]).toLowerCase() : '';
        if (status === 'duplicate') {
          var dup = C.dupOf !== undefined ? str_(r[C.dupOf]) : '';
          var orig = enqOfKey[dup] || enqOfKey['L-' + dup];
          if (orig && orig !== enq) addTimeline_(orig, null, 'Enquiry again', 'Same customer enquired again online (' + enq + ', ' + source + ').', '', '', '');
          continue;
        }
        if (isTestLead_(name, phone, email)) continue;
        var pk = phoneKey_(phone);
        var existing = (byPhone[pk] || []).filter(function (l) { return l.outcome === 'Open'; })[0];
        if (existing) {
          addTimeline_(existing.enquiryNo, null, 'Enquiry again', 'Same phone enquired again online (' + enq + ', ' + source + '). ' + (C.product !== undefined ? str_(r[C.product]) : ''), '', '', '');
          continue;
        }
        var sp = name.indexOf(' ');
        var prior = (byPhone[pk] || [])[0];
        var lead = newLead_({
          enquiryNo: enq, channel: 'Online feed', sourceRef: key, source: source, group: 'NBD',
          segment: /franchise/i.test(typ) ? 'Franchise' : 'Online',
          firstName: sp > 0 ? name.slice(0, sp) : name, lastName: sp > 0 ? name.slice(sp + 1) : '', phone: phone, email: email,
          city: C.loc !== undefined ? str_(r[C.loc]) : '', requirement: C.product !== undefined ? str_(r[C.product]) : '',
          notes: [/^landing/i.test(typ) ? '' : typ, C.details !== undefined ? str_(r[C.details]) : '', C.also !== undefined ? str_(r[C.also]) : ''].filter(Boolean).join(' | '),
          utmMedium: C.med !== undefined ? str_(r[C.med]) : '', utmCampaign: C.camp !== undefined ? str_(r[C.camp]) : '', addedByName: 'Online feed', createdAt: parseDetectedTime_(r[C.detected])
        }, team, prior ? 'Earlier enquiry: ' + prior.enquiryNo : '');
        leads.push(lead);
        (byPhone[pk] = byPhone[pk] || []).push(lead);
        bySource[key] = lead.enquiryNo;
      }
    }
    assignWaiting_();
  });
}

function repairOnlineDates() {
  withLock_(function () {
    var src = SpreadsheetApp.openById(LEAD_SHEET_ID).getSheets().filter(function (s) { return s.getSheetId() === LEAD_SHEET_GID; })[0];
    if (!src) return;
    var width = src.getLastColumn();
    var C = feedCols_(src.getRange(1, 1, 1, width).getValues()[0]);
    var vals = src.getLastRow() > 1 ? src.getRange(2, 1, src.getLastRow() - 1, width).getValues() : [];
    var when = {};
    vals.forEach(function (r) {
      var e = str_(r[C.enq]), t = parseDetectedTime_(r[C.detected]);
      if (e && t) when[e] = t;
    });
    var pa = tab_('PlannedActual'), paN = pa.getLastRow();
    var paRows = paN > 1 ? pa.getRange(2, 1, paN - 1, PA_COLS.length).getValues() : [];
    var fixed = 0;
    readLeads_().forEach(function (l) {
      var t = when[l.enquiryNo];
      if (l.channel !== 'Online feed' || !t || l.createdAt === t) return;
      l.createdAt = t;
      if (l.stage === 'New' && l.outcome === 'Open' && l.ownerId && /18:30$/.test(l.nextFollowUp)) {
        l.nextFollowUp = plannedCall_(t);
        paRows.forEach(function (p, i) {
          if (str_(p[0]) === l.enquiryNo && str_(p[1]) === 'First call' && !str_(p[4])) pa.getRange(i + 2, 4).setValue(l.nextFollowUp + ':00');
        });
      }
      writeLead_(l);
      fixed++;
    });
    Logger.log('Dates corrected on ' + fixed + ' leads');
  });
}

function assignWaiting_() {
  var leads = readLeads_().filter(function (l) { return l.outcome === 'Open' && !l.ownerId && l.group === 'NBD' && l.channel !== 'Imported'; });
  if (!leads.length) return;
  var team = readTeam_();
  leads.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
  leads.forEach(function (l) {
    var m = pickNbd_(team);
    if (!m) return;
    setOwner_(l, m); l.updatedAt = now_(); l.nextFollowUp = plannedCall_();
    writeLead_(l);
    addTimeline_(l.enquiryNo, null, 'Assigned', 'Assigned to ' + m.name, '', '', m.name);
    openStep_(l.enquiryNo, 'First call', m.name, l.nextFollowUp + ':00');
  });
}

function hourlyMaintenance() {
  withLock_(function () {
    var team = readTeam_();
    readLeads_().forEach(function (l) {
      if (l.outcome !== 'Open' || !l.ownerId) return;
      var o = memberById_(team, l.ownerId);
      if (o && o.active) return;
      var prev = l.ownerName;
      var back = memberById_(team, l.nbdId);
      var m = (back && back.active) ? back : pickNbd_(team);
      setOwner_(l, m); l.updatedAt = now_();
      writeLead_(l);
      addTimeline_(l.enquiryNo, null, 'Reassigned', 'Owner left. Returned to NBD.', '', prev, m ? m.name : '');
      if (m) { closeOpenStep_(l.enquiryNo); openStep_(l.enquiryNo, 'Follow-up', m.name, l.nextFollowUp || today_()); }
    });
  });
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    if (b.key !== PropertiesService.getScriptProperties().getProperty('CRM_KEY')) return jsonOut_({ ok: false, error: 'Unauthorized' });
    return jsonOut_(handle_(b));
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}
function doGet() { return jsonOut_({ ok: true, service: 'Little Nap CRM' }); }

function publicLead_(l) { var o = {}; LEAD_COLS.forEach(function (c) { if (c !== 'phoneKey') o[c] = l[c]; }); return o; }
function fail_(m) { throw new Error(m); }

function handle_(b) {
  schema_();
  switch (b.action) {
    case 'list': return actionList_();
    case 'timeline': return actionTimeline_(b);
    case 'set-available': return withLock_(function () { setAvailable_(str_(b.id), !!b.present); return { ok: true }; });
    default:
      return withLock_(function () {
        var team = readTeam_();
        switch (b.action) {
          case 'add-enquiry': return actionAdd_(b, team);
          case 'log-activity': return actionLog_(b, team);
          case 'mark-invalid': return actionOutcome_(b, 'Invalid');
          case 'mark-lost': return actionOutcome_(b, 'Lost');
          case 'reopen': return actionReopen_(b);
          case 'align': return actionAlign_(b, team);
          case 'send-back': return actionSendBack_(b, team);
          case 'reassign': return actionReassign_(b, team);
          case 'close-lead': return actionClose_(b);
          case 'link-quote': return actionLinkQuote_(b);
          case 'edit-contact': return actionEditContact_(b);
          default: fail_('Unknown action');
        }
      });
  }
}

function findLead_(enq) {
  var leads = readLeads_();
  for (var i = 0; i < leads.length; i++) if (leads[i].enquiryNo === enq) return leads[i];
  fail_('Lead not found: ' + enq);
}

function actionList_() {
  var cutoff = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), tz_(), 'yyyy-MM-dd HH:mm:ss');
  var leads = readLeads_().filter(function (l) { return l.outcome === 'Open' || l.updatedAt >= cutoff; }).map(publicLead_);
  var keep = {}; leads.forEach(function (l) { keep[l.enquiryNo] = true; });
  var quotes = readQuotes_().filter(function (q) { return keep[q.enquiryNo]; });
  return { ok: true, leads: leads, quotes: quotes, availability: availability_(), lists: readLists_(), now: now_() };
}
function readQuotes_() {
  var sh = tab_('Quotes'), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return [];
  var from = Math.max(2, n - 1999);
  return sh.getRange(from, 1, n - from + 1, QUOTE_COLS.length).getValues().map(function (row) {
    var o = {}; QUOTE_COLS.forEach(function (c, j) { o[c] = str_(row[j]); });
    return o;
  });
}

function actionLinkQuote_(b) {
  var enq = str_(b.enquiryNo), no = str_(b.quoteNo);
  if (!enq || !no) fail_('Enquiry and quotation number are required');
  var l = findLead_(enq);
  var have = readQuotes_();
  for (var i = 0; i < have.length; i++) if (have[i].quoteNo === no) return { ok: true, already: true };
  var isPi = str_(b.docType) === 'PI';
  var amount = Math.round(Number(b.amount) || 0);
  appendRow_(tab_('Quotes'), [enq, no, isPi ? 'PI' : 'Quotation', str_(b.brand), amount, str_(b.linkedQuote), str_(b.byId), str_(b.byName), today_()]);
  addTimeline_(enq, { id: b.byId, name: b.byName }, 'Quotation', (isPi ? 'Proforma invoice ' : 'Quotation ') + no + (str_(b.brand) ? ' (' + str_(b.brand) + ')' : '') + ', Rs. ' + amount.toLocaleString('en-IN'), '', '', '');
  l.updatedAt = now_();
  writeLead_(l);
  return { ok: true };
}

function actionEditContact_(b) {
  var l = findLead_(b.enquiryNo);
  var first = str_(b.firstName), last = str_(b.lastName);
  if (!first) fail_('Enter the customer name');
  var pk = phoneKey_(b.phone);
  if (pk.length < 10) fail_('Enter a 10 digit phone number');
  var alts = [], seen = {};
  seen[pk] = true;
  str_(b.altPhone).split(/[,;\n]+/).forEach(function (x) {
    x = str_(x);
    if (!x) return;
    var k = phoneKey_(x);
    if (k.length < 10) fail_('Other number "' + x + '" must be 10 digits');
    if (!seen[k]) { seen[k] = true; alts.push(k); }
  });
  var clash = readLeads_().filter(function (o) { return o.enquiryNo !== l.enquiryNo && o.phoneKey === pk; })[0];
  if (clash) fail_('This number is already on ' + clash.enquiryNo + ' (' + (clash.firstName + ' ' + clash.lastName).trim() + ')');
  var oldName = (l.firstName + ' ' + l.lastName).trim(), newName = (first + ' ' + last).trim();
  var oldNums = [l.phone].concat(str_(l.altPhone) ? str_(l.altPhone).split(',') : []).join(', ');
  var newNums = [pk].concat(alts).join(', ');
  var changes = [];
  if (oldName !== newName) changes.push('Name: ' + oldName + ' to ' + newName);
  if (oldNums !== newNums) changes.push('Phone: ' + oldNums + ' to ' + newNums);
  if (!changes.length) return { ok: true, unchanged: true };
  l.firstName = first; l.lastName = last;
  l.phone = pk; l.phoneKey = pk; l.altPhone = alts.join(', ');
  l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Contact corrected', changes.join('. '), '', '', '');
  return { ok: true };
}

function actionTimeline_(b) {
  var sh = tab_('Timeline'), n = sh.getLastRow(), out = [];
  if (n >= 2) {
    var hits = sh.getRange(2, 2, n - 1, 1).createTextFinder(str_(b.enquiryNo)).matchEntireCell(true).findAll();
    hits.forEach(function (h) {
      var v = sh.getRange(h.getRow(), 1, 1, TL_COLS.length).getValues()[0];
      var o = {}; TL_COLS.forEach(function (c, j) { o[c] = str_(v[j]); });
      out.push(o);
    });
  }
  return { ok: true, timeline: out };
}

function actionAdd_(b, team) {
  var f = b.fields || {};
  if (!str_(f.firstName) || !str_(f.source)) fail_('Name and lead source are required');
  var pk = phoneKey_(f.phone);
  if (pk.length < 10) fail_('Enter a 10 digit phone number');
  var by = memberById_(team, b.byId) || { id: b.byId, name: b.byName };
  f.channel = 'In-app'; f.addedBy = b.byId; f.addedByName = b.byName; f.group = groupOf_(f.source);
  var same = readLeads_().filter(function (l) { return l.phoneKey === pk; });
  if (same.length && !b.decision) {
    var open = same.filter(function (l) { return l.outcome === 'Open'; })[0] || same[same.length - 1];
    return { ok: true, duplicate: { enquiryNo: open.enquiryNo, name: (open.firstName + ' ' + open.lastName).trim(), ownerName: open.ownerName, stage: open.stage, outcome: open.outcome, source: open.source } };
  }
  if (same.length && b.decision === 'note') {
    var target = same.filter(function (l) { return l.outcome === 'Open'; })[0] || same[same.length - 1];
    addTimeline_(target.enquiryNo, by, 'Enquiry again', 'Customer enquired again (' + f.source + '). ' + str_(f.notes), '', '', '');
    target.updatedAt = now_(); writeLead_(target);
    return { ok: true, enquiryNo: target.enquiryNo, added: 'note' };
  }
  var lead = newLead_(f, team, same.length ? 'Earlier enquiry: ' + same[0].enquiryNo : '');
  saveSelfLead_(lead, f);
  return { ok: true, enquiryNo: lead.enquiryNo, ownerName: lead.ownerName, waiting: !lead.ownerId };
}

function saveSelfLead_(lead, f) {
  try {
    var ss = SpreadsheetApp.openById(LEAD_SHEET_ID);
    var sh = ss.getSheetByName(SELF_TAB);
    if (!sh) {
      sh = ss.insertSheet(SELF_TAB);
      sh.getRange(1, 1, 1, SELF_COLS.length).setValues([SELF_COLS]).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.getRange(2, 1, sh.getMaxRows() - 1, SELF_COLS.length).setNumberFormat('@');
    }
    sh.appendRow([lead.enquiryNo, lead.createdAt, lead.addedBy, str_(f.addedBy), lead.source, lead.segment, lead.title, lead.firstName,
      lead.lastName, lead.company, lead.designation, lead.phone, lead.email, lead.city, lead.state, lead.zone, lead.requirement,
      lead.quantity, lead.notes]);
  } catch (e) {}
}

function actionLog_(b, team) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome !== 'Open') fail_('This lead is ' + l.outcome + '. Reopen it first.');
  var by = { id: b.byId, name: b.byName };
  var type = LOG_TYPES.indexOf(b.type) >= 0 ? b.type : 'Note';
  var stage = normStage_(b.stage);
  var next = str_(b.nextFollowUp);
  if (!next) fail_('Next follow-up date is required');
  var text = str_(b.text) || (stage === 'Not connected' ? 'Call not connected' : '');
  if (!text) fail_('Write the remarks');
  addTimeline_(l.enquiryNo, by, type, text, next, '', '');
  closeOpenStep_(l.enquiryNo);
  if (stage && STAGES.indexOf(stage) >= 0 && stage !== 'Converted' && stage !== l.stage) {
    addTimeline_(l.enquiryNo, by, 'Stage', l.stage + ' to ' + stage, '', '', '');
    l.stage = stage;
  }
  l.nextFollowUp = next; l.updatedAt = now_();
  writeLead_(l);
  openStep_(l.enquiryNo, l.stage, l.ownerName, next);
  return { ok: true };
}

function actionOutcome_(b, outcome) {
  var l = findLead_(b.enquiryNo);
  if (!str_(b.reason)) fail_('A reason is required');
  closeOpenStep_(l.enquiryNo);
  l.outcome = outcome; l.reason = str_(b.reason); l.updatedAt = now_(); l.nextFollowUp = '';
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, outcome, (LOG_TYPES.indexOf(b.type) >= 0 && b.type !== 'Note' ? b.type + '. ' : '') + str_(b.reason) + (b.text ? '. ' + b.text : ''), '', '', '');
  return { ok: true };
}

function actionReopen_(b) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome === 'Closed') fail_('A closed sale cannot be reopened');
  var next = str_(b.nextFollowUp);
  if (!next) fail_('Next follow-up date is required');
  l.outcome = 'Open'; l.reason = ''; l.nextFollowUp = next; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Reopened', str_(b.text), next, '', '');
  openStep_(l.enquiryNo, l.stage, l.ownerName, next);
  return { ok: true };
}

function actionAlign_(b, team) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome !== 'Open') fail_('This lead is ' + l.outcome);
  var to = memberById_(team, b.toId);
  if (!to || !to.active || to.team !== 'Sales') fail_('Pick an active salesperson');
  if (!str_(b.meetingDate)) fail_('Meeting date is required');
  var from = l.ownerName;
  closeOpenStep_(l.enquiryNo);
  setOwner_(l, to);
  l.salesId = to.id; l.salesName = to.name;
  if (SALES_STAGES.indexOf(l.stage) < 0) l.stage = '1st meeting';
  l.meetingDate = str_(b.meetingDate); l.meetingTime = str_(b.meetingTime);
  l.nextFollowUp = l.meetingDate; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Aligned', str_(b.text) + ' Meeting ' + l.meetingDate + (l.meetingTime ? ' ' + l.meetingTime : ''), l.meetingDate, from, to.name);
  openStep_(l.enquiryNo, l.stage, to.name, l.meetingDate + (l.meetingTime ? ' ' + l.meetingTime + ':00' : ''));
  return { ok: true, ownerName: to.name };
}

function actionSendBack_(b, team) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome !== 'Open') fail_('This lead is ' + l.outcome);
  if (!str_(b.text)) fail_('Add a note for NBD');
  var next = str_(b.nextFollowUp);
  if (!next) fail_('Next follow-up date is required');
  var to = l.nbdId ? memberById_(team, l.nbdId) : memberById_(team, b.toId);
  if ((!to || !to.active || to.team !== 'NBD') && b.toId) to = memberById_(team, b.toId);
  if (!to || !to.active || to.team !== 'NBD') to = pickNbd_(team);
  if (!to) fail_('No NBD person is available right now');
  var from = l.ownerName;
  closeOpenStep_(l.enquiryNo);
  setOwner_(l, to); l.nextFollowUp = next; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, LOG_TYPES.indexOf(b.type) >= 0 && b.type !== 'Note' ? b.type + ', sent to sales coordinator' : 'Sent to sales coordinator', b.text, next, from, to.name);
  openStep_(l.enquiryNo, l.stage, to.name, next);
  return { ok: true, ownerName: to.name };
}

function actionReassign_(b, team) {
  var l = findLead_(b.enquiryNo);
  var to = memberById_(team, b.toId);
  if (!to || !to.active || (to.team !== 'NBD' && to.team !== 'Sales')) fail_('Pick an active NBD or Sales person');
  var from = l.ownerName;
  closeOpenStep_(l.enquiryNo);
  setOwner_(l, to); l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Reassigned', str_(b.text), '', from, to.name);
  if (to.team === 'Sales') { l.salesId = to.id; l.salesName = to.name; if (SALES_STAGES.indexOf(l.stage) < 0) l.stage = '1st meeting'; writeLead_(l); }
  openStep_(l.enquiryNo, l.stage, to.name, l.nextFollowUp || today_());
  return { ok: true, ownerName: to.name };
}

function actionClose_(b) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome !== 'Open') fail_('This lead is ' + l.outcome);
  if (!str_(b.opf) || !str_(b.orderValue)) fail_('OPF number and order value are required');
  closeOpenStep_(l.enquiryNo);
  l.outcome = 'Closed'; l.stage = 'Converted'; l.opf = str_(b.opf); l.orderValue = str_(b.orderValue);
  l.nextFollowUp = ''; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Closed', (LOG_TYPES.indexOf(b.type) >= 0 && b.type !== 'Note' ? b.type + '. ' : '') + 'Sale reported. OPF ' + l.opf + ', value ' + l.orderValue + (str_(b.text) ? '. ' + str_(b.text) : ''), '', '', '');
  return { ok: true };
}

var IMPORT_LEAD_COLS = ['Enquiry No', 'Name', 'Phone', 'Email', 'City', 'Source', 'Requirement', 'Quantity', 'Owner ID', 'NBD ID', 'Stage', 'Next Follow-up', 'Meeting Date', 'Created On', 'Status'];
var IMPORT_REMARK_COLS = ['Enquiry No', 'Date', 'By', 'Remark'];

function setupImport() {
  var ss = SpreadsheetApp.getActive();
  [['Import Leads', IMPORT_LEAD_COLS], ['Import Remarks', IMPORT_REMARK_COLS]].forEach(function (d) {
    var sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
    sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, sh.getMaxRows() - 1, d[1].length).setNumberFormat('@');
  });
}

function normDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = str_(v);
  if (!s) return '';
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return s.slice(0, 10);
}

function importOpenLeads() {
  withLock_(function () {
    var ss = SpreadsheetApp.getActive();
    var ls = ss.getSheetByName('Import Leads'), rs = ss.getSheetByName('Import Remarks');
    if (!ls || ls.getLastRow() < 2) return;
    var team = readTeam_();
    var cityMap = loadCityMap_();
    var existing = {};
    readLeads_().forEach(function (l) { existing[l.enquiryNo] = true; });
    var remarks = {};
    if (rs && rs.getLastRow() > 1) {
      rs.getRange(2, 1, rs.getLastRow() - 1, 4).getValues().forEach(function (r) {
        var k = str_(r[0]);
        if (!k) return;
        (remarks[k] = remarks[k] || []).push({ date: normDate_(r[1]), by: str_(r[2]), text: str_(r[3]) });
      });
    }
    var n = ls.getLastRow() - 1;
    var rows = ls.getRange(2, 1, n, IMPORT_LEAD_COLS.length).getValues();
    var statusCol = IMPORT_LEAD_COLS.length;
    rows.forEach(function (r, i) {
      if (str_(r[statusCol - 1]) === 'Imported') return;
      var set = function (msg) { ls.getRange(i + 2, statusCol).setValue(msg); };
      var name = str_(r[1]);
      if (!name && !str_(r[2])) return;
      var pk = phoneKey_(r[2]);
      var owner = memberById_(team, str_(r[8]));
      var stage = normStage_(r[10]) || (owner && owner.team === 'Sales' ? '1st meeting' : 'Follow-up');
      var next = normDate_(r[11]);
      if (pk.length < 10) return set('Error: phone must be 10 digits');
      if (!owner || !owner.active || (owner.team !== 'NBD' && owner.team !== 'Sales')) return set('Error: Owner ID must be an active NBD or Sales person');
      if (STAGES.indexOf(stage) < 0 || stage === 'Converted') return set('Error: stage must be New, Not connected, Follow-up, 1st meeting, Send proposal or Negotiation');
      if (!next) return set('Error: Next Follow-up date is required');
      var enq = str_(r[0]) || nextEnquiryNo_();
      if (existing[enq]) return set('Error: ' + enq + ' is already in the CRM');
      var parts = name.split(' ');
      var first = parts.shift(), last = parts.join(' ');
      var loc = matchLocation_(str_(r[4]), cityMap);
      var source = str_(r[5]);
      var created = normDate_(r[13]);
      var lead = {
        enquiryNo: enq, createdAt: created ? created + ' 00:00:00' : now_(), channel: 'Imported', sourceRef: '', source: source, group: groupOf_(source),
        segment: '', title: '', firstName: first, lastName: last, company: '', designation: '', phone: str_(r[2]), phoneKey: pk, email: str_(r[3]),
        city: str_(r[4]), state: loc.state, zone: loc.zone, requirement: str_(r[6]), quantity: str_(r[7]), notes: '', utmMedium: '', utmCampaign: '',
        addedBy: 'Import', ownerId: '', ownerName: '', ownerTeam: '', nbdId: '', nbdName: '', stage: stage, outcome: 'Open', reason: '',
        nextFollowUp: next, meetingDate: normDate_(r[12]), meetingTime: '', opf: '', orderValue: '', updatedAt: now_()
      };
      setOwner_(lead, owner);
      if (owner.team === 'Sales') { lead.salesId = owner.id; lead.salesName = owner.name; }
      var nbd = memberById_(team, str_(r[9]));
      if (nbd && nbd.team === 'NBD' && !lead.nbdId) { lead.nbdId = nbd.id; lead.nbdName = nbd.name; }
      appendLead_(lead);
      var tl = tab_('Timeline');
      (remarks[enq] || []).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (m) {
        appendRow_(tl, [(m.date || today_()) + ' 00:00:00', enq, '', m.by, 'Note', m.text, '', '', '']);
      });
      addTimeline_(enq, null, 'Imported', 'Open lead brought in from the old Sales Engine', next, '', owner.name);
      openStep_(enq, stage === 'New' ? 'First call' : stage, owner.name, next);
      existing[enq] = true;
      set('Imported');
    });
  });
}

var FMS_SHEET_IDS = ['1MChhRpBr6pNe1zolhuIuMsPJ7DRrx_qG0RD24oqYQCI'];
var FMS_FIRST_ROW = 8;
var FMS_SOURCE_NAME = { 'walk in': 'Walk-In', 'what hi-fi2022': 'What Hi-Fi' };
var FMS_COLS = {
  at: 'A', key: 'B', name: 'C', salesman: 'D', phone: 'E', email: 'F', city: 'G', zone: 'H', source: 'I', message: 'K', manual: 'L',
  callDone: 'N', callStatus: 'O', valid: 'P', callRemarks: 'R', requirement: 'S',
  fuPlan: 'U', fuAct: 'V', fuStatus: 'W', assigned: 'X', meetType: 'Y', meetDate: 'Z', meetTime: 'AA',
  mtgAct: 'AE', mtgStatus: 'AF', mtgRemarks: 'AG', propDate: 'AH', propAct: 'AJ', propStatus: 'AK', propRemarks: 'AL', propValue: 'AN', nextProp: 'AO', nextSc: 'AP',
  n1Act: 'AS', n1Status: 'AT', n1Remarks: 'AU', n2Status: 'BB', n2Remarks: 'BC', nextN2: 'AW', n2Date: 'AX', n2Time: 'AY', n2Act: 'BA',
  final: 'BD', orderValue: 'BE', opf: 'BG', modified: 'BH', nextN3: 'BJ', n3Act: 'BM', n3Status: 'BN', n3Remarks: 'BO',
  nextN4: 'BQ', n4Date: 'BR', n4Time: 'BS', n4Act: 'BU', n4Status: 'BV', n4Remarks: 'BW'
};

function colIndex_(letters) {
  var n = 0;
  for (var i = 0; i < letters.length; i++) n = n * 26 + letters.charCodeAt(i) - 64;
  return n - 1;
}

function parseFmsDate_(v) {
  var s = str_(v);
  if (!s) return null;
  var m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  var y, mo, d, hh = '00', mi = '00', ss = '00';
  if (m) {
    d = m[1]; mo = m[2]; y = m[3];
    if (m[4]) { hh = m[4]; mi = m[5]; ss = m[6] || '00'; }
  } else {
    m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (!m) return null;
    mo = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }[m[2].toLowerCase()];
    if (!mo) return null;
    d = m[1]; y = m[3];
    if (m[4]) { hh = m[4]; mi = m[5]; ss = m[6] || '00'; }
  }
  if (String(y).length === 2) y = '20' + y;
  var p = function (x) { return ('0' + x).slice(-2); };
  var date = y + '-' + p(mo) + '-' + p(d);
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return { date: date, time: p(hh) + ':' + mi + ':' + ss, full: date + ' ' + p(hh) + ':' + mi + ':' + ss };
}

function fmsPeople_(team) {
  var list = team.filter(function (m) { return m.team === 'NBD' || m.team === 'Sales'; });
  var norm = function (s) { return str_(s).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  return {
    find: function (name, wantTeam) {
      var n = norm(name);
      if (!n || n === 'me' || n === 'sales coordinator') return null;
      var pool = list.filter(function (m) { return !wantTeam || m.team === wantTeam; });
      var exact = pool.filter(function (m) { return norm(m.name) === n; });
      if (exact.length === 1) return exact[0];
      var first = n.split(' ')[0];
      var hits = pool.filter(function (m) { return norm(m.name).split(' ')[0] === first; });
      return hits.length === 1 ? hits[0] : null;
    }
  };
}

function fmsStage_(g) {
  if (g('n4Status') || g('n3Status') || g('n2Status') || g('n1Status') || g('n4Remarks') || g('n3Remarks') || g('n2Remarks') || g('n1Remarks')) return 'Negotiation';
  if (g('propStatus') || g('propAct') || g('propRemarks')) return 'Send proposal';
  if (g('mtgStatus') || g('mtgAct') || g('mtgRemarks') || (g('assigned') && g('meetDate'))) return '1st meeting';
  if (g('fuStatus') || g('fuAct')) return 'Follow-up';
  if (/^not/i.test(g('callStatus'))) return 'Not connected';
  if (g('callStatus')) return 'Follow-up';
  return 'New';
}

function fmsLead_(g, ctx) {
  var enq = g('key');
  var created = parseFmsDate_(g('at'));
  var name = g('name') || 'Unknown';
  var sp = name.indexOf(' ');
  var digits = g('phone').replace(/\D/g, '');
  var manual = g('manual').replace(/\D/g, '');
  var phone = digits.length >= 10 ? digits.slice(-10) : (manual.length >= 10 ? manual.slice(-10) : digits);
  var rawSource = g('source');
  var source = FMS_SOURCE_NAME[rawSource.toLowerCase()] || rawSource;
  var group = 'Direct';
  for (var i = 0; i < ctx.sources.length; i++) if (ctx.sources[i].name.toLowerCase() === source.toLowerCase()) { group = ctx.sources[i].group; source = ctx.sources[i].name; break; }
  var finalStatus = g('final').toLowerCase();
  var outcome = 'Open';
  if (finalStatus === 'lost') outcome = 'Lost';
  else if (finalStatus === 'invalid') outcome = 'Invalid';
  else if (finalStatus === 'closed') outcome = 'Closed';
  else if (!finalStatus && /^invalid/i.test(g('valid'))) outcome = 'Invalid';
  var stage = fmsStage_(g);
  var lastRemark = g('n4Remarks') || g('n3Remarks') || g('n2Remarks') || g('n1Remarks') || g('propRemarks') || g('mtgRemarks') || g('callRemarks');
  var loc = matchLocation_(g('city'), ctx.cityMap);
  var meetingDate = '', meetingTime = '';
  var next = '';
  var later = stage === '1st meeting' || stage === 'Send proposal' || stage === 'Negotiation';
  var nameFor = g('assigned') || g('salesman');
  var person = later ? ctx.people.find(nameFor, 'Sales') : (ctx.people.find(g('salesman'), 'NBD') || null);
  if (!person && later && g('salesman')) person = ctx.people.find(g('salesman'), 'Sales');
  var d;
  if (stage === 'Negotiation') {
    d = parseFmsDate_(g('nextN4') || g('nextN3') || g('nextN2') || g('nextSc'));
    var md = parseFmsDate_(g('n4Date') || g('n2Date'));
    if (md) { meetingDate = md.date; meetingTime = /^\d{1,2}:\d{2}/.test(g('n4Time') || g('n2Time')) ? (g('n4Time') || g('n2Time')) : ''; }
  } else if (stage === 'Send proposal') {
    d = parseFmsDate_(g('nextProp') || g('nextSc'));
  } else if (stage === '1st meeting') {
    d = parseFmsDate_(g('meetDate')) || parseFmsDate_(g('nextSc'));
    var m1 = parseFmsDate_(g('meetDate'));
    if (m1) { meetingDate = m1.date; meetingTime = /^\d{1,2}:\d{2}/.test(g('meetTime')) ? g('meetTime') : ''; }
  } else if (stage === 'Follow-up') {
    d = parseFmsDate_(g('fuPlan'));
  }
  next = d ? d.date : '';
  var today = today_();
  if (outcome === 'Open' && !next) next = today;
  var modified = parseFmsDate_(g('modified'));
  var money = function (v) { return String(v || '').replace(/[^0-9.]/g, ''); };
  var notes = [];
  if (g('message')) notes.push(g('message'));
  if (nameFor && !person) notes.push('Salesperson in the old sheet: ' + nameFor);
  var lead = {
    enquiryNo: enq, createdAt: created ? created.full : now_(), channel: 'Imported', sourceRef: 'FMS', source: source, group: group,
    segment: '', title: '', firstName: sp > 0 ? name.slice(0, sp) : name, lastName: sp > 0 ? name.slice(sp + 1) : '', company: '', designation: '',
    phone: phone, phoneKey: phoneKey_(phone), email: g('email'), city: g('city'), state: loc.state, zone: loc.zone || g('zone'),
    requirement: (g('requirement') || g('message')).slice(0, 80), quantity: '', notes: notes.join(' | ').slice(0, 1000), utmMedium: '', utmCampaign: '',
    addedBy: 'Import', ownerId: '', ownerName: '', ownerTeam: '', nbdId: '', nbdName: '', stage: stage, outcome: outcome,
    reason: outcome === 'Lost' || outcome === 'Invalid' ? lastRemark.slice(0, 300) : '', nextFollowUp: outcome === 'Open' ? next : '',
    meetingDate: meetingDate, meetingTime: meetingTime, opf: '', orderValue: '', updatedAt: modified ? modified.full : (created ? created.full : now_()),
    salesId: '', salesName: '', altPhone: manual.length >= 10 && manual.slice(-10) !== phone ? manual.slice(-10) : ''
  };
  if (outcome === 'Closed') { lead.stage = 'Converted'; lead.opf = g('opf'); lead.orderValue = money(g('orderValue') || g('propValue')); }
  var unmatched = '';
  if (person && (outcome !== 'Open' || person.active)) {
    setOwner_(lead, person);
    if (person.team === 'Sales') { lead.salesId = person.id; lead.salesName = person.name; }
  } else if (nameFor && outcome === 'Open' && later) {
    unmatched = nameFor;
  }
  return { lead: lead, unmatched: unmatched };
}

function fmsTimelineFromRow_(g, enq) {
  var steps = [
    ['First call', 'callDone', 'callStatus', 'callRemarks'], ['1st meeting', 'mtgAct', 'mtgStatus', 'mtgRemarks'],
    ['Send proposal', 'propAct', 'propStatus', 'propRemarks'], ['Negotiation 1', 'n1Act', 'n1Status', 'n1Remarks'],
    ['Negotiation 2', 'n2Act', 'n2Status', 'n2Remarks'], ['Negotiation 3', 'n3Act', 'n3Status', 'n3Remarks'], ['Negotiation 4', 'n4Act', 'n4Status', 'n4Remarks']
  ];
  var out = [];
  steps.forEach(function (s) {
    var remark = g(s[3]);
    if (!remark) return;
    var t = parseFmsDate_(g(s[1]));
    out.push([t ? t.full : now_(), enq, '', 'Old Sales Engine', 'Note', ('[' + s[0] + (g(s[2]) ? ' · ' + g(s[2]) : '') + '] ' + remark).slice(0, 3000), '', '', '']);
  });
  return out;
}

function fmsReadSheet_(id) {
  var ss = SpreadsheetApp.openById(id);
  var fms = ss.getSheetByName('FMS');
  if (!fms) throw new Error('No FMS tab in ' + id);
  var head = fms.getRange(7, 1, 1, colIndex_('BD') + 1).getDisplayValues()[0];
  if (str_(head[colIndex_('B')]).toLowerCase() !== 'primary key' || !/^current status/i.test(str_(head[colIndex_('BD')]))) throw new Error('FMS header row 7 does not match the expected layout in ' + id);
  var n = fms.getLastRow() - FMS_FIRST_ROW + 1;
  var vals = n > 0 ? fms.getRange(FMS_FIRST_ROW, 1, n, colIndex_('CD') + 1).getDisplayValues() : [];
  var history = {};
  var sp = ss.getSheetByName('SP RP All');
  if (sp && sp.getLastRow() > 1) {
    sp.getRange(2, 1, sp.getLastRow() - 1, 9).getDisplayValues().forEach(function (r) {
      var e = str_(r[3]);
      if (!e) return;
      var t = parseFmsDate_(r[2]);
      var text = '[' + str_(r[1]) + (str_(r[4]) ? ' · ' + str_(r[4]) : '') + '] ' + str_(r[5]);
      (history[e] = history[e] || []).push([t ? t.full : '', e, '', 'Old Sales Engine', 'Note', text.slice(0, 3000), '', '', '']);
    });
  }
  return { rows: vals, history: history };
}

function fmsIds_() {
  var p = PropertiesService.getScriptProperties().getProperty('FMS_SHEET_IDS');
  return p ? p.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : FMS_SHEET_IDS;
}

function fmsContext_() {
  var team = readTeam_();
  return { team: team, people: fmsPeople_(team), cityMap: loadCityMap_(), sources: readLists_().Source };
}

function fmsGetter_(row) {
  return function (k) { var i = colIndex_(FMS_COLS[k]); return i < row.length ? str_(row[i]) : ''; };
}

function previewFms() {
  var ctx = fmsContext_();
  var ids = fmsIds_();
  var ss = SpreadsheetApp.getActive();
  var stat = { outcome: {}, stage: {}, openStage: {}, unmatched: {}, noPhone: 0, total: 0, already: 0 };
  var existing = {};
  readLeads_().forEach(function (l) { existing[l.enquiryNo] = true; });
  var sample = [], per = { Open: 0, Closed: 0, Lost: 0, Invalid: 0 };
  ids.forEach(function (id) {
    var src = fmsReadSheet_(id);
    src.rows.forEach(function (row) {
      var g = fmsGetter_(row);
      if (!g('key')) return;
      var r = fmsLead_(g, ctx), l = r.lead;
      stat.total++;
      if (existing[l.enquiryNo]) stat.already++;
      stat.outcome[l.outcome] = (stat.outcome[l.outcome] || 0) + 1;
      stat.stage[l.stage] = (stat.stage[l.stage] || 0) + 1;
      if (l.outcome === 'Open') stat.openStage[l.stage] = (stat.openStage[l.stage] || 0) + 1;
      if (l.phoneKey.length < 10) stat.noPhone++;
      if (r.unmatched) stat.unmatched[r.unmatched] = (stat.unmatched[r.unmatched] || 0) + 1;
      if (per[l.outcome] < (l.outcome === 'Open' ? 10 : 4) && (src.history[l.enquiryNo] || fmsTimelineFromRow_(g, l.enquiryNo)).length) {
        per[l.outcome]++;
        sample.push([l.enquiryNo, l.firstName + ' ' + l.lastName, l.phone, l.city, l.state, l.source, l.group, l.stage, l.outcome, l.ownerName, l.nextFollowUp, l.meetingDate, l.createdAt, l.opf, l.orderValue, l.reason, (src.history[l.enquiryNo] || fmsTimelineFromRow_(g, l.enquiryNo)).length]);
      }
    });
  });
  var sh = ss.getSheetByName('Import Preview') || ss.insertSheet('Import Preview');
  sh.clear();
  var head = ['Enquiry No', 'Name', 'Phone', 'City', 'State', 'Source', 'Group', 'Stage', 'Outcome', 'Owner', 'Next follow-up', 'Meeting date', 'Created', 'OPF', 'Order value', 'Reason', 'Timeline notes'];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (sample.length) sh.getRange(2, 1, sample.length, head.length).setValues(sample);
  var line = function (o) { return Object.keys(o).sort().map(function (k) { return k + ': ' + o[k]; }).join(', '); };
  var rep = [
    ['Leads in the old sheets', stat.total], ['Already in the CRM', stat.already], ['By outcome', line(stat.outcome)], ['Open leads by step', line(stat.openStage)],
    ['Without a 10 digit phone', stat.noPhone], ['Open leads whose salesperson is not in the portal (will wait unassigned)', line(stat.unmatched)]
  ];
  var rs = ss.getSheetByName('Import Report') || ss.insertSheet('Import Report');
  rs.clear();
  rs.getRange(1, 1, rep.length, 2).setValues(rep);
  rs.getRange(1, 1, rep.length, 1).setFontWeight('bold');
  rs.setColumnWidth(1, 420); rs.setColumnWidth(2, 700);
  Logger.log(JSON.stringify(stat));
}

function appendBatch_(sh, rows) {
  if (!rows.length) return;
  var width = rows[0].length, start = sh.getLastRow() + 1, need = start + rows.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 500);
  var rng = sh.getRange(start, 1, rows.length, width);
  rng.setNumberFormat('@');
  rng.setValues(rows);
}

function importFms() {
  withLock_(function () {
    var started = Date.now();
    var ctx = fmsContext_();
    var existing = {};
    readLeads_().forEach(function (l) { existing[l.enquiryNo] = true; });
    var leadSh = tab_('Leads'), tlSh = tab_('Timeline'), paSh = tab_('PlannedActual');
    var done = 0, skipped = 0, waiting = 0, stopped = false;
    fmsIds_().forEach(function (id) {
      if (stopped) return;
      var src = fmsReadSheet_(id);
      var leadRows = [], tlRows = [], paRows = [];
      var flush = function () {
        appendBatch_(leadSh, leadRows); appendBatch_(tlSh, tlRows); appendBatch_(paSh, paRows);
        leadRows = []; tlRows = []; paRows = [];
      };
      for (var i = 0; i < src.rows.length; i++) {
        var g = fmsGetter_(src.rows[i]);
        if (!g('key')) continue;
        if (existing[g('key')]) { skipped++; continue; }
        if (Date.now() - started > 270000) { stopped = true; break; }
        var r = fmsLead_(g, ctx), l = r.lead;
        leadRows.push(LEAD_COLS.map(function (c) { return l[c] === undefined ? '' : l[c]; }));
        var hist = src.history[l.enquiryNo] || fmsTimelineFromRow_(g, l.enquiryNo);
        hist.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
        hist.forEach(function (h) { if (!h[0]) h[0] = l.createdAt; tlRows.push(h); });
        tlRows.push([now_(), l.enquiryNo, '', 'Import', 'Imported', 'Brought in from the old Sales Engine', l.nextFollowUp, '', l.ownerName]);
        if (l.outcome === 'Open' && l.ownerId) paRows.push([l.enquiryNo, l.stage === 'New' ? 'First call' : l.stage, l.ownerName, l.nextFollowUp, '', '']);
        if (l.outcome === 'Open' && !l.ownerId) waiting++;
        existing[l.enquiryNo] = true;
        done++;
        if (leadRows.length >= 250) flush();
      }
      flush();
    });
    Logger.log('Imported ' + done + ', skipped ' + skipped + ' already in the CRM, open without owner ' + waiting + (stopped ? '. Time ran out: run importFms again to continue.' : '. Finished.'));
  });
}
