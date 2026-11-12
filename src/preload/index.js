import { contextBridge, ipcRenderer } from 'electron'

const call = async (channel, ...args) => {
  const r = await ipcRenderer.invoke(channel, ...args)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

const api = {
  getSettings: () => call('settings:get'),
  saveSettings: (patch) => call('settings:save', patch),
  pickAsset: (key) => call('settings:pickAsset', key),
  clearAsset: (key) => call('settings:clearAsset', key),

  listStudents: () => call('students:list'),
  saveStudent: (oldNisn, data) => call('students:save', oldNisn, data),
  deleteStudents: (nisns) => call('students:delete', nisns),
  importStudents: () => call('students:import'),
  downloadTemplate: (kind) => call('template:download', kind),

  openPhotoSource: (kind) => call('photos:openSource', kind),
  readPhotoEntry: (sessionId, key) => call('photos:readEntry', sessionId, key),
  closePhotoSource: () => call('photos:closeSource'),
  pickSinglePhoto: () => call('photos:pickSingle'),
  savePhoto: (nisn, orig, crop) => call('photos:save', nisn, orig, crop),
  deletePhoto: (nisn) => call('photos:delete', nisn),
  readOriginalPhoto: (nisn) => call('photos:readOriginal', nisn),

  listExams: () => call('exams:list'),
  saveExam: (exam) => call('exams:save', exam),
  deleteExam: (id) => call('exams:delete', id),
  listParticipants: (examId) => call('participants:list', examId),
  saveParticipant: (examId, p) => call('participants:save', examId, p),
  deleteParticipants: (ids) => call('participants:delete', ids),
  clearParticipants: (examId) => call('participants:clear', examId),
  importParticipants: (examId) => call('participants:import', examId),

  getPrintData: (job) => call('print:data', job),
  exportPdf: (job, name) => call('export:pdf', job, name),
  exportPng: (job, name) => call('export:png', job, name),
  onExportProgress: (cb) => {
    const h = (_e, p) => cb(p)
    ipcRenderer.on('export:progress', h)
    return () => ipcRenderer.removeListener('export:progress', h)
  },

  // dipakai jendela cetak tersembunyi
  printReady: (payload) => ipcRenderer.send('print:ready', payload),
  pngReady: (payload) => ipcRenderer.send('png:ready', payload),
  pngShown: (payload) => ipcRenderer.send('png:shown', payload),
  onPngShow: (cb) => ipcRenderer.on('png:show', (_e, p) => cb(p)),

  backup: () => call('backup:create'),
  restore: () => call('backup:restore'),
  dataDir: () => call('app:dataDir'),
  openDataDir: () => call('app:openDataDir')
}

contextBridge.exposeInMainWorld('api', api)
