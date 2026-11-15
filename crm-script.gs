var SALE_REPORT_ID = '1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU';
var LEAD_SHEET_ID = '13DxQgqHFYXd2YIQ6eO0uscJ_LOENpRw59msxk5cIg4U';
var LEAD_SHEET_GID = 1382477988;
var APP_PREFIX = 'LNS';
var SELF_TAB = 'Self Leads';
var SELF_COLS = ['Enquiry No', 'Date', 'Added By', 'Added By ID', 'Source', 'Segment', 'Title', 'First Name', 'Last Name', 'Company', 'Designation', 'Phone', 'Email', 'City', 'State', 'Zone', 'Requirement', 'Quantity', 'Notes'];
var FIRST_CALL_HOURS = 2;
var MAX_PER_RUN = 60;

var LEAD_COLS = ['enquiryNo', 'createdAt', 'channel', 'sourceRef', 'source', 'group', 'segment', 'title', 'firstName', 'lastName',
  'company', 'designation', 'phone', 'phoneKey', 'email', 'city', 'state', 'zone', 'requirement', 'quantity', 'notes',
  'utmMedium', 'utmCampaign', 'addedBy', 'ownerId', 'ownerName', 'ownerTeam', 'nbdId', 'nbdName', 'stage', 'outcome',
  'reason', 'nextFollowUp', 'meetingDate', 'meetingTime', 'opf', 'orderValue', 'updatedAt'];
var TL_COLS = ['time', 'enquiryNo', 'byId', 'byName', 'type', 'text', 'nextFollowUp', 'fromName', 'toName'];
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
var STAGES = ['New', 'Contacted', 'Valid', 'Meeting', 'Proposal', 'Negotiation', 'Converted'];

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
  [['Leads', LEAD_COLS], ['Timeline', TL_COLS], ['PlannedActual', PA_COLS], ['Availability', ['id', 'present', 'updatedAt']], ['CityMap', ['city', 'state']]]
    .forEach(function (d) {
      var sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
      if (sh.getRange(1, 1).getValue() !== d[1][0]) {
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
  try { return fn(); } finally { lock.releaseLock(); }
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
    if (adder.team === 'Sales') lead.stage = 'Contacted';
  } else {
    owner = pickNbd_(team);
  }
  setOwner_(lead, owner);
  appendLead_(lead);
  addTimeline_(lead.enquiryNo, adder, 'Created', 'Added from ' + (lead.source || lead.channel) + (how ? '. ' + how : ''), '', '', lead.ownerName);
  if (owner) {
    var p = Utilities.formatDate(new Date(Date.now() + FIRST_CALL_HOURS * 3600000), tz_(), 'yyyy-MM-dd HH:mm:ss');
    openStep_(lead.enquiryNo, 'First call', owner.name, p);
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

function assignWaiting_() {
  var leads = readLeads_().filter(function (l) { return l.outcome === 'Open' && !l.ownerId && l.group === 'NBD'; });
  if (!leads.length) return;
  var team = readTeam_();
  leads.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
  leads.forEach(function (l) {
    var m = pickNbd_(team);
    if (!m) return;
    setOwner_(l, m); l.updatedAt = now_();
    writeLead_(l);
    addTimeline_(l.enquiryNo, null, 'Assigned', 'Assigned to ' + m.name, '', '', m.name);
    openStep_(l.enquiryNo, 'First call', m.name, Utilities.formatDate(new Date(Date.now() + FIRST_CALL_HOURS * 3600000), tz_(), 'yyyy-MM-dd HH:mm:ss'));
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
  return { ok: true, leads: leads, availability: availability_(), lists: readLists_(), now: now_() };
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
  var type = ['Call', 'Note', 'Follow-up', 'WhatsApp', 'Meeting'].indexOf(b.type) >= 0 ? b.type : 'Note';
  var next = str_(b.nextFollowUp);
  if (!next) fail_('Next follow-up date is required');
  if (!str_(b.text)) fail_('Write what happened');
  addTimeline_(l.enquiryNo, by, type, b.text, next, '', '');
  closeOpenStep_(l.enquiryNo);
  if (b.stage && STAGES.indexOf(b.stage) >= 0 && b.stage !== l.stage) {
    addTimeline_(l.enquiryNo, by, 'Stage', l.stage + ' to ' + b.stage, '', '', '');
    l.stage = b.stage;
  }
  l.nextFollowUp = next; l.updatedAt = now_();
  writeLead_(l);
  openStep_(l.enquiryNo, l.stage === 'New' ? 'Follow-up' : l.stage, l.ownerName, next);
  return { ok: true };
}

function actionOutcome_(b, outcome) {
  var l = findLead_(b.enquiryNo);
  if (!str_(b.reason)) fail_('A reason is required');
  closeOpenStep_(l.enquiryNo);
  l.outcome = outcome; l.reason = str_(b.reason); l.updatedAt = now_(); l.nextFollowUp = '';
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, outcome, str_(b.reason) + (b.text ? '. ' + b.text : ''), '', '', '');
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
  openStep_(l.enquiryNo, 'Follow-up', l.ownerName, next);
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
  l.stage = 'Meeting'; l.meetingDate = str_(b.meetingDate); l.meetingTime = str_(b.meetingTime);
  l.nextFollowUp = l.meetingDate; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Aligned', str_(b.text) + ' Meeting ' + l.meetingDate + (l.meetingTime ? ' ' + l.meetingTime : ''), l.meetingDate, from, to.name);
  openStep_(l.enquiryNo, 'Meeting', to.name, l.meetingDate + (l.meetingTime ? ' ' + l.meetingTime + ':00' : ''));
  return { ok: true, ownerName: to.name };
}

function actionSendBack_(b, team) {
  var l = findLead_(b.enquiryNo);
  if (l.outcome !== 'Open') fail_('This lead is ' + l.outcome);
  if (!str_(b.text)) fail_('Add a note for NBD');
  var next = str_(b.nextFollowUp);
  if (!next) fail_('Next follow-up date is required');
  var to = b.toId ? memberById_(team, b.toId) : memberById_(team, l.nbdId);
  if (!to || !to.active || to.team !== 'NBD') to = pickNbd_(team);
  if (!to) fail_('No NBD person is available right now');
  var from = l.ownerName;
  closeOpenStep_(l.enquiryNo);
  setOwner_(l, to); l.nextFollowUp = next; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Sent back', b.text, next, from, to.name);
  openStep_(l.enquiryNo, 'Follow-up', to.name, next);
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
  openStep_(l.enquiryNo, 'Follow-up', to.name, l.nextFollowUp || today_());
  return { ok: true, ownerName: to.name };
}

function actionClose_(b) {
  var l = findLead_(b.enquiryNo);
  closeOpenStep_(l.enquiryNo);
  l.outcome = 'Closed'; l.stage = 'Converted'; l.opf = str_(b.opf); l.orderValue = str_(b.orderValue);
  l.nextFollowUp = ''; l.updatedAt = now_();
  writeLead_(l);
  addTimeline_(l.enquiryNo, { id: b.byId, name: b.byName }, 'Closed', 'Sale reported. OPF ' + l.opf + ', value ' + l.orderValue, '', '', '');
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
      var stage = str_(r[10]) || 'Contacted';
      var next = normDate_(r[11]);
      if (pk.length < 10) return set('Error: phone must be 10 digits');
      if (!owner || !owner.active || (owner.team !== 'NBD' && owner.team !== 'Sales')) return set('Error: Owner ID must be an active NBD or Sales person');
      if (STAGES.indexOf(stage) < 0 || stage === 'Converted') return set('Error: stage must be New, Contacted, Valid, Meeting, Proposal or Negotiation');
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
