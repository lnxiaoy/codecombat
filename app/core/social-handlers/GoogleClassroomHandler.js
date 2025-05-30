import api from 'core/api'
import CocoClass from 'core/CocoClass'
const SCOPE = 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/classroom.rosters.readonly'

const utils = require('core/utils')

const GoogleClassroomAPIHandler = class GoogleClassroomAPIHandler extends CocoClass {

  constructor () {
    if (me.useGoogleClassroom()) {
      application.gplusHandler.loadAPI()
    }
    super()
  }

  loadClassroomsFromAPI () {
    return new Promise((resolve, reject) => {
      const fun = () => {
        gapi.client.load('classroom', 'v1', () => {
          gapi.client.classroom.courses.list({ access_token: application.gplusHandler.token(), teacherId: me.get('gplusID'), courseStates: 'ACTIVE' })
            .then((r) => {
              resolve(r.result.courses || [])
            })
            .catch((err) => {
              console.error('Error in fetching from Google Classroom loadClassroom:', err)
              reject(err)
            })
        })
      }
      this.requestGoogleAccessToken(fun)
    })
  }

  loadStudentsFromAPI (googleClassroomId, nextPageToken='') {
    return new Promise((resolve, reject) => {
      const fun = () => gapi.client.load('classroom', 'v1', () => {
        gapi.client.classroom.courses.students.list({ access_token: application.gplusHandler.token(), courseId: googleClassroomId, pageToken: nextPageToken })
        .then((r) => {
            resolve(r.result || {})
          })
        .catch ((err) => {
            console.error('Error in fetching from Google Classroom loadStudent:', err)
            reject(err)
          })
        })
      if (!application.gplusHandler.token()) this.requestGoogleAccessToken(fun)
      else fun()
    })
  }

  requestGoogleAccessToken (callback) {
    application.gplusHandler.requestGoogleAuthorization(
      SCOPE,
      callback
    )
  }

}

module.exports = {
  gcApiHandler: new GoogleClassroomAPIHandler(),

  scopes: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/classroom.rosters.readonly',

  markAsImported: async function(gcId) {
    try {
      let gClass = me.get('googleClassrooms').find((c)=>c.id==gcId)
      if (gClass) {
        if (utils.isCodeCombat) {
          gClass.importedToCoco = true
        } else {
          gClass.importedToOzaria = true
        }
        await new Promise(me.save().then)
      }
      else {
        return Promise.reject("Classroom not found in me.googleClassrooms")
      }
    }
    catch (err) {
      console.error("Error in marking classroom as imported:", err)
      return Promise.reject("Error in marking classroom as imported")
    }
  },

  // import classrooms from GC and merge them into me.googleClassrooms
  // this also sets `deletedFromGC` for classrooms that are removed from GC but had already been imported to coco/ozaria
  importClassrooms: async function() {
    try {
      const importedClassrooms = await this.gcApiHandler.loadClassroomsFromAPI()
      const importedClassroomsNames = importedClassrooms.map((c) => {
        return { id: c.id, name: c.name }
      })
      const classrooms = me.get('googleClassrooms') || []
      let mergedClassrooms = []
      importedClassroomsNames.forEach((imported) => {
        const cl = classrooms.find((c) => c.id == imported.id)
        mergedClassrooms.push({ ...cl, ...imported })
      })

      // classrooms that were imported to coco/ozaria but no more exist in importedClassroomNames, i.e. have been removed from google classroom
      const mergedClassroomIds = mergedClassrooms.map((m) => m.id)
      const extraClassroomsImported = classrooms.filter((c) => (c.importedToCoco || c.importedToOzaria) && !(mergedClassroomIds.includes(c.id)))
      // set deletedFromGC, so that it gets filtered from the dropdown on the create classroom modal
      // for example, a class that is importedToOzaria but deleted from GC should not be available in the dropdown on coco
      extraClassroomsImported.forEach((e) => e.deletedFromGC = true)
      mergedClassrooms = mergedClassrooms.concat(extraClassroomsImported)
      me.set('googleClassrooms', mergedClassrooms)
      await new Promise(me.save().then)
    }
    catch (err) {
      console.error("Error in importing classrooms", err)
      return Promise.reject()
    }
  },

  // Imports students from google classroom, create their account on coco and add to the coco classroom
  importStudentsToClassroom: async function (cocoClassroom) {
    const store = require('core/store')
    try {
      cocoClassroom = cocoClassroom?.attributes || cocoClassroom
      const googleClassroomId = cocoClassroom.googleClassroomId

      let importedStudents = []
      let importStudentsResult = await this.gcApiHandler.loadStudentsFromAPI(googleClassroomId)
      importedStudents = importedStudents.concat(importStudentsResult.students || [])
      while ((importStudentsResult.nextPageToken || '').length > 0) {
        const nextPageToken = importStudentsResult.nextPageToken
        importStudentsResult = await this.gcApiHandler.loadStudentsFromAPI(googleClassroomId, nextPageToken)
        importedStudents = importedStudents.concat(importStudentsResult.students || [])
      }

      let promises = []
      for (let student of importedStudents){
        let attrs = {
          firstName: student.profile.name.givenName,
          lastName: student.profile.name.familyName,
          email: student.profile.emailAddress,
          gplusID: student.userId
        }
        promises.push(api.users.signupFromGoogleClassroom(attrs))
      }
      const signupStudentsResult = await Promise.all(promises.map((p) => p.catch((err) => { err.isError=true; return err })))

      const createdStudents = signupStudentsResult.filter((s) => !s.isError)
      const signupErrors = signupStudentsResult.filter((s) => s.isError && s.errorID != 'student-account-exists')
      const existingStudents = signupStudentsResult
        .filter((s) => s.errorID === 'student-account-exists') // TODO update error id to 'account-exists' since it might contain teacher/individual accounts also
        .map((s) => s.error) // error contains the user object here
        .filter((s) => (utils.isCodeCombat || s.role === 'student')) // For Ozaria: filter only student accounts, discard existing individual/teacher accounts

      console.debug("Students created:", createdStudents)

      // Log errors for students whose accounts did not get created
      if (signupErrors.length > 0)
        console.error("Error in creating some students:", signupErrors)

      //Students to add in classroom = created students + existing students that are not already part of the classroom
      const classroomNewMembers = createdStudents.concat(existingStudents.filter((s) => !cocoClassroom.members.includes(s._id)))

      if (classroomNewMembers.length > 0) {
        if (utils.isCodeCombat) {
          await api.classrooms.addMembers({ classroomID: cocoClassroom._id, members: classroomNewMembers })
        } else {
          await store.dispatch('classrooms/addMembersToClassroom', { classroom: cocoClassroom, members: classroomNewMembers })
        }
        noty ( {text: classroomNewMembers.length+' Students imported.', layout: 'topCenter', timeout: 3000, type: 'success' })
        return classroomNewMembers
      } else if (utils.isCodeCombat) {
        console.error("No new students imported. Error:", signupStudentsResult)
        return Promise.reject('No new students imported')
      }
      else if (signupErrors.length > 0) {
        console.error("No new students imported. Error:", signupErrors)
        return Promise.reject('No new students imported')
      }
      else {
        noty({ text: $.i18n.t('teachers.no_new_students_imported'), layout: 'topCenter', type: 'success', timeout: 3000 })
        return []
      }
    }
    catch (err) {
      console.error("Error in importing students", err)
      return Promise.reject(`Error in importing students: ${err.message}`)
    }
  }
}
