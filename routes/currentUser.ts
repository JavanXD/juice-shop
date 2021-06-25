/*
 * Copyright (c) 2014-2021 Bjoern Kimminich.
 * SPDX-License-Identifier: MIT
 */

import utils = require('../lib/utils')
const security = require('../lib/insecurity')
const cache = require('../data/datacache')
const challenges = cache.challenges
const sqreen = require('sqreen')

module.exports = function retrieveLoggedInUser () {
  return (req, res) => {
    let user
    try {
      if (security.verify(req.cookies.token)) {
        user = security.authenticatedUsers.get(req.cookies.token)
      }
    } catch (err) {
      user = undefined
    } finally {
      const response = { user: { id: (user?.data ? user.data.id : undefined), email: (user?.data ? user.data.email : undefined), lastLoginIp: (user?.data ? user.data.lastLoginIp : undefined), profileImage: (user?.data ? user.data.profileImage : undefined) } }
      sqreen.identify(req, { username: (user?.data ? user.data.email : undefined) })
      if (req.query.callback === undefined) {
        res.json(response)
      } else {
        utils.solveIf(challenges.emailLeakChallenge, () => { return true })
        res.jsonp(response)
      }
    }
  }
}
