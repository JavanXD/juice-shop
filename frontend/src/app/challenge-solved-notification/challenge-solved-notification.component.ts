import { TranslateService } from '@ngx-translate/core'
import { ChallengeService } from '../Services/challenge.service'
import { ConfigurationService } from '../Services/configuration.service'
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core'
import { CookieService } from 'ngx-cookie'
import { CountryMappingService } from 'src/app/Services/country-mapping.service'
import { SocketIoService } from '../Services/socket-io.service'

import { library, dom } from '@fortawesome/fontawesome-svg-core'
import { faClipboard, faFlagCheckered, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { environment } from '../../environments/environment'

library.add(faGlobe, faFlagCheckered, faClipboard)
dom.watch()

@Component({
  selector: 'app-challenge-solved-notification',
  templateUrl: './challenge-solved-notification.component.html',
  styleUrls: ['./challenge-solved-notification.component.scss']
})
export class ChallengeSolvedNotificationComponent implements OnInit {

  public notifications: any[] = []
  public showCtfFlagsInNotifications
  public showCtfCountryDetailsInNotifications
  public ctfdHost
  public countryMap
  public hostServer = environment.hostServer

  constructor (private ngZone: NgZone, private configurationService: ConfigurationService, private challengeService: ChallengeService,private countryMappingService: CountryMappingService,private translate: TranslateService, private cookieService: CookieService, private ref: ChangeDetectorRef, private io: SocketIoService, private http: HttpClient) {
  }

  ngOnInit () {
    this.ngZone.runOutsideAngular(() => {
      this.io.socket().on('challenge solved', (data) => {
        if (data && data.challenge) {
          if (!data.hidden) {
            this.showNotification(data)
          }
          if (!data.isRestore) {
            this.saveProgress()
          }
          this.io.socket().emit('notification received', data.flag)
        }
      })
    })

    this.configurationService.getApplicationConfiguration().subscribe((config) => {
      if (config && config.ctf) {
        if (config.ctf.showFlagsInNotifications !== null) {
          this.showCtfFlagsInNotifications = config.ctf.showFlagsInNotifications
        } else {
          this.showCtfFlagsInNotifications = false
        }

        if (config.ctf.ctfdHost !== null) {
          this.ctfdHost = config.ctf.ctfdHost
        } else {
          this.ctfdHost = false
        }

        if (config.ctf.showCountryDetailsInNotifications) {
          this.showCtfCountryDetailsInNotifications = config.ctf.showCountryDetailsInNotifications

          if (config.ctf.showCountryDetailsInNotifications !== 'none') {
            this.countryMappingService.getCountryMapping().subscribe((countryMap) => {
              this.countryMap = countryMap
            },(err) => console.log(err))
          }
        } else {
          this.showCtfCountryDetailsInNotifications = 'none'
        }
      }
    })
  }

  closeNotification (index) {
    this.notifications.splice(index, 1)
    this.ref.detectChanges()
  }

  showNotification (challenge) {
    this.translate.get('CHALLENGE_SOLVED', { challenge: challenge.challenge }).toPromise().then((challengeSolved) => challengeSolved,
      (translationId) => translationId).then((message) => {
        let country
        if (this.showCtfCountryDetailsInNotifications && this.showCtfCountryDetailsInNotifications !== 'none') {
          country = this.countryMap[challenge.key]
        }
        this.notifications.push({
          message: message,
          flag: challenge.flag,
          country: country,
          copied: false
        })
        if (this.ctfdHost) {
          this.attemptCTFdChallenge(challenge)
        }
        this.ref.detectChanges()
      })
  }

  attemptCTFdChallenge (challenge) {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json'
      })
    }
    return this.http.get< { status, data: [{key, id}] }>(this.hostServer + '/api/Challenges', { responseType: 'json' }).subscribe(result => {
      if (result.status === 'success' && result.data && result.data.length > 0) {
        const challenges = result.data
        const challengeId = Number.parseInt(challenges.find(cl => cl.key === challenge.key).id, 10)
        return this.http.post(this.ctfdHost + '/api/v1/challenges/attempt', { 'challenge_id': challengeId, 'submission': challenge.flag }, httpOptions).subscribe()
      } else {
        console.log(result)
      }
    },(err) => console.log(err))

  }

  saveProgress () {
    this.challengeService.continueCode().subscribe((continueCode) => {
      if (!continueCode) {
        throw (new Error('Received invalid continue code from the sever!'))
      }
      let expires = new Date()
      expires.setFullYear(expires.getFullYear() + 1)
      this.cookieService.put('continueCode', continueCode, { expires })
    },(err) => console.log(err))
  }

}
