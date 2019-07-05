import { Component } from '@angular/core';
import { Alert, AlertController, IonicPage, NavController, ViewController } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import { AppVersion } from '@ionic-native/app-version';
import { Subscription } from 'rxjs/Subscription';
import { of } from 'rxjs/observable/of';
import { defer } from 'rxjs/observable/defer';
import { catchError, delay, repeatWhen, switchMap, first, map } from 'rxjs/operators';
import { Observable } from 'rxjs/Observable';
import { NgRedux } from '@angular-redux/store';

import { AppActions, AppTasks, StateStore } from 'app-engine';
import { OpenNativeSettings } from '@ionic-native/open-native-settings';

import { ThemeService } from '../../providers/theme-service';
import { CheckNetworkService } from '../../providers/check-network';

@IonicPage()
@Component({
  selector: 'page-device-create',
  templateUrl: 'device-create.html'
})
export class DeviceCreatePage {

  private subs: Array<Subscription>;
  private deviceInfo$: Observable<any>;
  canContinue: boolean = false;
  canLocalMode: boolean = false;
  canGpsMode: boolean = false;
  canBroadcast: boolean = false;
  canLocalBroadcast: boolean = false;
  canCapsuleMode: boolean = false;
  canCloudMode: boolean = true;
  isTokenValidated: boolean = false;
  appName: Promise<string>;
  alert: Alert;

  constructor(
    private stateStore: StateStore,
    private appTasks: AppTasks,
    private ngRedux: NgRedux<any>,
    private translate: TranslateService,
    public alertCtrl: AlertController,
    public appVersion: AppVersion,
    public checkNetworkService: CheckNetworkService,
    public nativeSettings: OpenNativeSettings,
    public navCtrl: NavController,
    public themeService: ThemeService,
    public viewCtrl: ViewController,
  ) {
    this.subs = [];
    this.appName = this.appVersion.getAppName();
    this.deviceInfo$ = this.ngRedux.select(['ssidConfirm', 'deviceInfo']);
  }

  ionViewDidLoad() {
    this.checkNetworkService.pause();
  }

  ionViewWillEnter() {
    this.subs.push(
      this.queryDeviceInfo()
        .pipe(repeatWhen(attampes => attampes.pipe(delay(3000))))
        .subscribe()
    );
    this.subs.push(
      this.deviceInfo$
        .subscribe(deviceInfo => {
          this.canLocalMode = deviceInfo && (deviceInfo.TenxLocal === "1" || deviceInfo.TenxLocal === "2");
          this.canGpsMode = deviceInfo && deviceInfo.TenxGps === "1";
          this.canBroadcast = deviceInfo && deviceInfo.TenxBroadcast === "1";
          this.canLocalBroadcast = deviceInfo && deviceInfo.TenxLocalBroadcast === "1";
          this.canCapsuleMode = deviceInfo && deviceInfo.TenxCapsule === "1";
          this.canCloudMode = deviceInfo && deviceInfo.TenxLocal !== "2" && (!deviceInfo.TenxCloud || deviceInfo.TenxCloud === "1");
        })
    );
  }

  private queryDeviceInfo() {
    return defer(() => this.appTasks.queryDeviceInfoTask())
      .pipe(
        switchMap(() =>
          this.stateStore.account$
            .pipe(
              first(),
              map(account => {
                const current = Date.now() / 1000 | 0;
                if (account.pTokenBundle &&
                  account.pTokenBundle.token &&
                  current < account.pTokenBundle.expires_in) {
                  return true;
                }
                this.appTasks.wsRequestProvisionTokenTask();
                this.showAlert();
                return false;
              }),
            )
        ),
        catchError(() => of(false)),
        map(result => this.canContinue = result),
      );
  }

  ionViewDidLeave() {
    this.subs && this.subs.forEach((s) => {
      s.unsubscribe();
    });
    this.subs.length = 0;
  }

  ionViewWillUnload() {
    this.checkNetworkService.resume();
  }

  onNext() {
    this.navCtrl.push('SsidConfirmPage')
      .then(() => this.closePage());
  }

  onLocalMode() {
    this.navCtrl.push('LocalModeDeviceItemPage')
      .then(() => this.closePage());
  }

  onGpsMode() {
    this.navCtrl.push('GpsDevicePage')
      .then(() => this.closePage());
  }

  onBroadcast() {
    this.navCtrl.push('BroadcastPage', { mode: "Broadcast" })
      .then(() => this.closePage());
  }

  onLocalBroadcast() {
    this.navCtrl.push('BroadcastPage', { mode: "Local Broadcast" })
      .then(() => this.closePage());
  }

  onCapsuleMode() {
    this.navCtrl.push('CapsuleDevicePage')
      .then(() => this.closePage());
  }

  closePage() {
    this.viewCtrl.dismiss();
    this.canLocalMode = false;
    this.canGpsMode = false;
    this.canBroadcast = false;
    this.canCapsuleMode = false;
    this.canCloudMode = true;
  }

  private showAlert() {
    if (!this.alert) {
      this.alert = this.alertCtrl.create({
        title: this.translate.instant('DEVICE_CREATE.OUT_OF_DATE_TITLE'),
        message: this.translate.instant('DEVICE_CREATE.OUT_OF_DATE_MSG'),
        buttons: [this.translate.instant('DEVICE_CREATE.OK')]
      });
      this.alert.present();
      this.alert.onDidDismiss(() => {
        this.alert = null;
      });
    }
  }
}

const INITIAL_STATE = {
  deviceInfo: null,
};

export function deviceCreateReducer(state = INITIAL_STATE, action) {
  switch (action.type) {
    case AppActions.QUERY_DEVICE_INFO_DONE:
      if (!action.error) {
        return Object.assign({}, state, { deviceInfo: action.payload, });
      }
      return state;
    default:
      return state;
  }
}
