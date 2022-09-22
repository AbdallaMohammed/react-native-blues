import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, LogBox, Text, ToastAndroid, TouchableHighlight, View } from 'react-native';
import { EnabledIndicator, PopupConfirm, SvgIcon } from '../components';
import * as Auth from '../modules/auth';
import * as Blues from "../modules/bluetooth";
import * as Music from '../modules/music';
import { commonStyles } from "../styles/commonStyles";
LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message

const SongListScreen = () => {
  const [isBluetoothEnabled, setBluetoothEnabled] = useState((async()=>await Blues.isBluetoothEnabled())());
  const [isScanning, setScanning] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [songList, setSongList] = useState([]);
  const [packetText, setPacketText] = useState(null);

  const [isPopupVisible, showPopupVisible] = useState(false);

  useEffect(() => {
    console.log('>> useEffect()');

    const setEvents = () => {
      console.log('setEvents()');

      Blues.setEvent("bluetoothStateChanging", () => {
        console.log('>> bluetoothStateChanging');
      });
      Blues.setEvent("bluetoothStateChanged", () => {
        console.log('>> bluetoothStateChanged');
      });
      Blues.setEvent("bluetoothEnabled", () => {
        ToastAndroid.show("블루투스가 활성화되었습니다.", ToastAndroid.LONG);
        setBluetoothEnabled(true);
      });
      Blues.setEvent("bluetoothDisabled", () => {
        console.log('>> bluetoothDisabled');
        ToastAndroid.show("블루투스가 비활성화되었습니다.", ToastAndroid.LONG);
        setBluetoothEnabled(false);
        showPopupVisible(true);
      });
      Blues.setEvent("deviceDiscovered", async (device) => {
        console.log('>> deviceDiscovered:', device);
        if (device.name === 'MH-M38') {
          console.log('>> deviceDiscovered(): speaker found. start connecting...');
          const isScanStopped = await Blues.stopScan();
          if (isScanStopped) {
            try {
              const conn = await Blues.connect(device.id);
              console.log('>> deviceDiscovered: conn=', conn);
            } catch (e) {
              console.error('error occurred when connecting:', e);
            }
          } else {
            console.error('>> deviceDiscovered: error: scan could not stop.');
          }
        }
      });
      Blues.setEvent("scanStarted", () => {
        console.log('>> scanStarted: scanning started.');
      });
      Blues.setEvent("scanStopped", () => {
        console.log('>> scanStopped: scanning stopped.');
        setScanning(false);
      });
      Blues.setEvent("deviceConnected", () => {
        console.log('>> deviceConnected');
        setConnected(true);
      });
      Blues.setEvent("deviceDisconnected", () => {
        console.log('>> deviceDisconnected');
        setConnected(false);
      });
    };

    setEvents();
    Auth.requestPermissions().then((r) => {
      Blues.isBluetoothEnabled().then(enabled => {
        setBluetoothEnabled(enabled);
        showPopupVisible(!enabled);
      }).then(() => {
        Music.init();
        const musicFileList = Music.list();
        setSongList(musicFileList);
      });
    });
    
    const onUnmount = () => {
      Blues.removeAllEvents();
      Music.close();
    };
    
    return onUnmount;
  }, []);

  const startScan = async () => {
    setScanning(true);
    const pairedDevices = await Blues.getPairedDeviceList();
    console.log('>> startScan(): devices=', pairedDevices);
    let foundDevice = pairedDevices?.find(d => d.name === 'MH-M38');
    if (foundDevice) {
      setScanning(false);
      console.log('>> startScan(): speaker found. start connecting...', foundDevice);
      const conn = await Blues.connect(foundDevice.id);
      console.log('>> startScan(): conn:', conn);
    } else {
      console.log('>> startScan(): device not found in paired devices. start scanning...');
      await Blues.startScan();
    }
  };

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.header}>
        <View style={{flexDirection: 'row'}}>
          <Text style={{marginRight: 10}}>블루투스 스피커 연결</Text>
          <EnabledIndicator isEnabled={isBluetoothEnabled}  style={commonStyles.enabled} />
          <SvgIcon name={isConnected ? 'link' : 'unlink'} color='#fff' />
        </View>
        <View style={{flexDirection: 'row'}}>
          {isScanning ? <ActivityIndicator /> : null}
          <TouchableHighlight
            disabled={isScanning}
            style={[commonStyles.btn, isScanning ? {backgroundColor: '#ccc'} : null]}
            underlayColor='#ddd'
            activeOpacity={0.95}
            onPress={()=>{
              if (isConnected) {
                Blues.disconnect();
              } else {
                startScan();
              }
            }}
          >
            <Text style={commonStyles.btnText}>{isConnected ? 'DISCONNECT' : 'CONNECT'}</Text>
          </TouchableHighlight>
        </View>
      </View>
      <View style={commonStyles.body}>
        <FlatList style={commonStyles.list}
          data={songList}
          renderItem={({item}) => {
            return (
              <TouchableHighlight
                underlayColor='#ddd'
                activeOpacity={0.95}
                onPress={() => {
                  console.log("selected file :", item.path);
                  Music.play(item.name, item.path);
                }}
                style={commonStyles.item}>
                <>
                  <Text style={commonStyles.itemTitle}>{item.name}</Text>
                  <Text style={commonStyles.itemSubtitle}>{item.path}</Text>
                </>
              </TouchableHighlight>
            );
          }}
          keyExtractor={item => item.id} />
      </View>
      <View style={commonStyles.footer}>
        <View style={{flex: 0}}>

        </View>
        <View style={{flex: 0}}>
          <TouchableHighlight
            underlayColor='#ddd'
            style={[commonStyles.btn]}
            onPress={() => {
              (async () => {
                console.log('TEST> get connected device:', await Blues.getConnectedDevice());
              })();
            }}
          >
            <Text style={commonStyles.btnText}>Check connected Device</Text>
          </TouchableHighlight>
        </View>
      </View>
      <PopupConfirm
        visible={isPopupVisible}
        title='블루투스 활성화'
        message='블루투스가 활성화되어있지 않습니다. 블루투스를 활성화하시겠습니까?'
        onCancel={() => {
          showPopupVisible(false);
        }}
        onConfirm={async () => {
          await Blues.enableBluetooth(() => {
            ToastAndroid.show("블루투스가 이미 활성화되어있습니다.", ToastAndroid.LONG);
          }).then(res => {
            if (res) {
              setBluetoothEnabled(true);
              showPopupVisible(false);
            }
          });
        }}
      />
    </View>
  );
};

export default SongListScreen;