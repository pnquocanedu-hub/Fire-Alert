import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, rtdb } from "./firebaseConfig";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  Linking,
  Switch,
  Platform,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { Ionicons } from "@expo/vector-icons";

// Link âm thanh cảnh báo MP3
const ALARM_SOUND_URL =
  "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

// =====================================================
// MÀN HÌNH ĐĂNG NHẬP
// =====================================================
function LoginScreen({ email, setEmail, password, setPassword, handleLogin }) {
  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.logoWrapper}>
        <Image
          source={require("./assets/logo-removebg-preview.png")}
          style={styles.loginLogo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.loginTitle}>Fire Alert</Text>

      <TextInput
        style={styles.loginInput}
        placeholder="Email"
        placeholderTextColor="#BDBDBD"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.loginInput}
        placeholder="Mật khẩu"
        placeholderTextColor="#BDBDBD"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => Alert.alert("Thông báo", "Màn hình khôi phục mật khẩu.")}
      >
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Đăng nhập</Text>
      </TouchableOpacity>

      <View style={styles.registerContainer}>
        <Text style={styles.registerNormal}>Chưa có tài khoản?</Text>
        <TouchableOpacity
          onPress={() => Alert.alert("Thông báo", "Màn hình đăng ký.")}
        >
          <Text style={styles.registerText}>Đăng ký</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =====================================================
// MAIN APP COMPONENT
// =====================================================
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("home");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Số điện thoại người thân
  const [emergencyPhone, setEmergencyPhone] = useState("0979060405");
  const [tempPhoneInput, setTempPhoneInput] = useState("0979060405");

  // Đồng hồ thời gian thực
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleString("vi-VN"),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trạng thái Modals
  const [isSosModalVisible, setIsSosModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);

  // Cài đặt ứng dụng
  const [pushNotification, setPushNotification] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [gasNotification, setGasNotification] = useState(true);

  // Quản lý âm thanh an toàn (Tránh văng app Expo Go)
  const audioRef = useRef(null);

  const playAlarmSound = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        if (!audioRef.current) {
          audioRef.current = new window.Audio(ALARM_SOUND_URL);
          audioRef.current.loop = true;
        }
        audioRef.current.play().catch(() => {});
      } catch (e) {
        console.log("Audio Web error:", e);
      }
    }
  };

  const stopAlarmSound = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {
        console.log("Audio Stop error:", e);
      }
    }
  };

  // Danh sách khu vực
  const [areas, setAreas] = useState([
    {
      id: "ESP32_001",
      name: "Phòng khách",
      deviceCode: "ESP32_001",
      icon: "car-outline",
      gas: 0,
      temperature: 30,
      flame: false,
      online: true,
      statusType: "normal",
      statusText: "An toàn",
      sosSent: false,
      wifiSignal: "Mạnh (85%)",
      ipAddress: "192.168.1.101",
    },
    {
      id: "ESP32_002",
      name: "Nhà bếp",
      deviceCode: "ESP32_002",
      icon: "restaurant-outline",
      gas: 120,
      temperature: 26,
      flame: false,
      online: true,
      statusType: "normal",
      statusText: "Phát hiện khí gas",
      sosSent: false,
      wifiSignal: "Tốt (72%)",
      ipAddress: "192.168.1.102",
    },
    {
      id: "ESP32_003",
      name: "Phòng ngủ 1",
      deviceCode: "ESP32_003",
      icon: "bed-outline",
      gas: 0,
      temperature: 28,
      flame: false,
      online: false,
      statusType: "normal",
      statusText: "Mất kết nối",
      sosSent: false,
      wifiSignal: "Không có",
      ipAddress: "N/A",
    },
    {
      id: "ESP32_004",
      name: "Phòng ngủ 2",
      deviceCode: "ESP32_004",
      icon: "bed-outline",
      gas: 0,
      temperature: 27,
      flame: false,
      online: false,
      statusType: "normal",
      statusText: "Mất kết nối",
      sosSent: false,
      wifiSignal: "Không có",
      ipAddress: "N/A",
    },
  ]);

  const [selectedArea, setSelectedArea] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const lastAlertRef = useRef(null);
  // Xử lý đăng nhập
  const handleLogin = async () => {
    if (email.trim() === "") {
      Alert.alert("Thông báo", "Vui lòng nhập Email!");
      return;
    }
    if (password.trim() === "") {
      Alert.alert("Thông báo", "Vui lòng nhập mật khẩu!");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setIsLoggedIn(true);
      setCurrentScreen("home");
    } catch (error) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        Alert.alert("Đăng nhập thất bại", "Sai email hoặc mật khẩu!");
      } else {
        Alert.alert("Lỗi", "Không thể đăng nhập. Vui lòng thử lại!");
      }
    }
  };

  const saveAlertHistory = async ({
    type,
    gas,
    temperature,
    flame,
    online,
  }) => {
    try {
      await addDoc(collection(db, "alert_history"), {
        type: type,
        gas: gas,
        temperature: temperature,
        flame: flame,
        esp32: online,
        timestamp: serverTimestamp(),
      });

      console.log("Đã lưu lịch sử:", type);
    } catch (error) {
      console.log("Lỗi lưu lịch sử:", error);
    }
  };

  // =====================================================
  // REALTIME DATABASE LISTENER
  // =====================================================
  useEffect(() => {
    if (!isLoggedIn) return;

    const systemRef = ref(rtdb, "HeThong");

    const unsubscribe = onValue(systemRef, async (snapshot) => {
      const data = snapshot.val();

      if (!data) return;

      const sensor = data.ThongSo_CamBien ?? {};
      const device = data.TinhTrang_ThietBi ?? {};

      let hasEmergency = false;
      let alertType = null;

      // ================================
      // ĐỌC DỮ LIỆU CẢM BIẾN
      // ================================
      const gasVal = sensor.NongDo_Gas_ppm ?? 0;
      const tempVal = sensor.NhietDo_C ?? 0;
      const flameVal = sensor.TrangThai_Lua;
      const flameDetected = flameVal === "Co lua lien tuc";
      const isOnline = device.ESP32 === "Online";

      // ================================
      // XÁC ĐỊNH MỨC CẢNH BÁO
      // ================================

      if (flameDetected) {
        alertType = "fire";
        hasEmergency = true;
      } else if (tempVal > 55 && gasVal >= 10000) {
        alertType = "fire";
        hasEmergency = true;
      } else if (gasVal > 1000) {
        alertType = "gas";
        hasEmergency = true;
      }

      // ================================
      // CẬP NHẬT CÁC KHU VỰC
      // ================================
      setAreas((prevAreas) =>
        prevAreas.map((area) => {
          if (
            area.deviceCode === "ESP32_002" ||
            area.deviceCode === "ESP32_001"
          ) {
            let sType = "normal";
            let sText = "An toàn";

            if (flameDetected) {
              sType = "fire";
              sText = "Cảnh báo cháy";
            } else if (tempVal >= 55 && gasVal >= 1000) {
              sType = "fire";
              sText = "Cảnh báo cháy";
            } else if (gasVal > 1000) {
              sType = "gas";
              sText = "Phát hiện khí gas";
            }

            return {
              ...area,
              gas: gasVal,
              temperature: tempVal,
              flame: flameVal,
              online: isOnline,
              statusType: sType,
              statusText: sText,
            };
          }

          return area;
        }),
      );

      // ================================
      // LƯU LỊCH SỬ FIRESTORE
      // ================================

      if (alertType) {
        // Chỉ lưu khi trạng thái cảnh báo thay đổi
        if (lastAlertRef.current !== alertType) {
          lastAlertRef.current = alertType;

          await saveAlertHistory({
            type: alertType,
            gas: gasVal,
            temperature: tempVal,
            flame: flameVal,
            online: isOnline,
          });
        }
      } else {
        // Khi trở lại bình thường,
        // cho phép lần cảnh báo tiếp theo được lưu
        lastAlertRef.current = null;
      }

      // ================================
      // ÂM THANH CẢNH BÁO
      // ================================
      if (hasEmergency && soundAlert) {
        playAlarmSound();
      } else {
        stopAlarmSound();
      }
    });

    return () => unsubscribe();
  }, [isLoggedIn, soundAlert]);

  // Firestore Listener
  useEffect(() => {
    if (!isLoggedIn) return;

    const q = query(
      collection(db, "alert_history"),
      orderBy("timestamp", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map((doc) => {
        const data = doc.data();
        let formattedTime = "N/A";
        if (data.timestamp?.toDate) {
          formattedTime = data.timestamp.toDate().toLocaleString("vi-VN");
        }
        return {
          id: doc.id,
          type: data.type,
          title: data.type === "fire" ? "FIRE WARNING" : "GAS WARNING",
          gas: data.gas ?? 0,
          temperature: data.temperature ?? 0,
          flame: data.flame ?? false,
          formattedTime: formattedTime,
        };
      });
      setHistoryData(history);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleConfirmSOS = () => {
    setIsSosModalVisible(false);
    if (selectedArea) {
      setAreas((prev) =>
        prev.map((item) =>
          item.id === selectedArea.id ? { ...item, sosSent: true } : item,
        ),
      );
      setSelectedArea((prev) => (prev ? { ...prev, sosSent: true } : null));
    }
    Linking.openURL(`tel:${emergencyPhone}`);
  };

  const handleSavePhone = () => {
    if (tempPhoneInput.trim() === "") {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại hợp lệ!");
      return;
    }
    setEmergencyPhone(tempPhoneInput.trim());
    setIsPhoneModalVisible(false);
    Alert.alert("Thành công", "Đã cập nhật số điện thoại khẩn cấp!");
  };

  const handleLogout = () => {
    stopAlarmSound();
    setIsLogoutModalVisible(false);
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
  };

  const ScreenHeader = ({ title, showBack = false, rightElement = null }) => (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            setSelectedArea(null);
            setCurrentScreen("home");
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#111" />
          <Text style={styles.headerTitle}>{title}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.headerTitle}>{title}</Text>
      )}
      {rightElement}
    </View>
  );

  const renderAreaListScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Trang chủ" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {areas.map((area) => {
          let cardBg = "#DDF7E3";
          let iconColor = "#2E7D32";

          // =========================
          // THIẾT BỊ OFFLINE
          // =========================
          if (!area.online) {
            cardBg = "#D1D5DB";
            iconColor = "#6B7280";
          }
          // =========================
          // THIẾT BỊ ONLINE
          // =========================
          else if (area.statusType === "gas") {
            cardBg = "#FFE8A3";
            iconColor = "#D97706";
          } else if (area.statusType === "fire") {
            cardBg = "#FFD8D8";
            iconColor = "#DC2626";
          }

          return (
            <TouchableOpacity
              key={area.id}
              style={[
                styles.areaCard,
                {
                  backgroundColor: cardBg,
                },
              ]}
              onPress={() => {
                setSelectedArea(area);
                setCurrentScreen("areaDetail");
              }}
            >
              <View style={styles.areaCardIcon}>
                <Ionicons name={area.icon} size={28} color={iconColor} />
              </View>

              <View style={styles.areaCardInfo}>
                <Text style={styles.areaCardTitle}>
                  {area.name} ({area.deviceCode})
                </Text>

                <Text
                  style={[
                    styles.areaCardSubText,
                    !area.online && { color: "#6B7280" },
                  ]}
                >
                  {area.online ? area.statusText : "Thiết bị Offline"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderAreaDetailScreen = () => {
    if (!selectedArea) return null;
    const currentArea =
      areas.find((a) => a.id === selectedArea.id) || selectedArea;

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title={currentArea.name} showBack={true} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {currentArea.sosSent && (
            <View style={styles.sosSentBanner}>
              <Ionicons name="notifications" size={20} color="#DC2626" />
              <Text style={styles.sosSentText}>Đã gửi tín hiệu SOS</Text>
            </View>
          )}

          {!currentArea.sosSent && currentArea.statusType === "normal" && (
            <View style={[styles.statusBanner, { backgroundColor: "#DDF7E3" }]}>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={[styles.statusBannerText, { color: "#16A34A" }]}>
                AN TOÀN
              </Text>
            </View>
          )}

          {!currentArea.sosSent && currentArea.statusType === "gas" && (
            <View style={[styles.statusBanner, { backgroundColor: "#FFE8A3" }]}>
              <Ionicons name="warning" size={22} color="#D97706" />
              <Text style={[styles.statusBannerText, { color: "#D97706" }]}>
                GAS ALERT
              </Text>
            </View>
          )}

          {!currentArea.sosSent && currentArea.statusType === "fire" && (
            <View style={[styles.statusBanner, { backgroundColor: "#FF2B2B" }]}>
              <Ionicons name="flame" size={22} color="#FFFFFF" />
              <Text style={[styles.statusBannerText, { color: "#FFFFFF" }]}>
                FIRE ALERT
              </Text>
            </View>
          )}

          <View style={styles.sensorBox}>
            <View style={styles.sensorRow}>
              <Ionicons name="flask" size={20} color="#222" />
              <Text style={styles.sensorName}>Gas</Text>
              <Text
                style={[
                  styles.sensorValue,
                  currentArea.gas >= 300 && { color: "#DC2626" },
                ]}
              >
                {currentArea.gas}ppm
              </Text>
            </View>

            <View style={styles.sensorRow}>
              <Ionicons name="thermometer" size={20} color="#DC2626" />
              <Text style={styles.sensorName}>Nhiệt độ</Text>
              <Text style={[styles.sensorValue, { color: "#DC2626" }]}>
                {currentArea.temperature} °C
              </Text>
            </View>

            <View style={styles.sensorRow}>
              <Ionicons
                name="flame"
                size={20}
                color={
                  currentArea.flame === "Co lua lien tuc"
                    ? "#DC2626"
                    : "#16A34A"
                }
              />

              <Text style={styles.sensorName}>Ngọn lửa</Text>

              <Text
                style={[
                  styles.sensorValue,
                  {
                    color:
                      currentArea.flame === "Co lua lien tuc"
                        ? "#DC2626"
                        : "#16A34A",
                  },
                ]}
              >
                {currentArea.flame}
              </Text>
            </View>

            <View style={styles.sensorRow}>
              <Ionicons name="wifi" size={20} color="#16A34A" />
              <Text style={styles.sensorName}>Trạng thái</Text>
              <Text style={[styles.sensorValue, { color: "#16A34A" }]}>
                {currentArea.deviceCode}{" "}
                {currentArea.online ? "online" : "offline"}
              </Text>
            </View>

            <View style={styles.sensorRow}>
              <Ionicons name="time" size={20} color="#222" />
              <Text style={styles.sensorName}>Thời gian</Text>
              <Text style={styles.sensorValue}>{currentTime}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.fireBtn}
            onPress={() => setIsSosModalVisible(true)}
          >
            <Text style={styles.fireBtnText}>Báo cháy khẩn cấp</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderHistoryScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Lịch sử cảnh báo" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {historyData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={60}
              color="#16A34A"
            />
            <Text style={styles.emptyText}>Chưa có lịch sử cảnh báo nào</Text>
          </View>
        ) : (
          historyData.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Ionicons
                  name={item.type === "fire" ? "flame" : "warning"}
                  size={20}
                  color={item.type === "fire" ? "#DC2626" : "#D97706"}
                />
                <Text style={styles.historyTitle}>{item.title}</Text>
              </View>
              <Text style={styles.historyDetail}>
                Khí Gas: {item.gas} ppm | Nhiệt độ: {item.temperature} °C
              </Text>
              <Text style={styles.historyTime}>
                Thời gian: {item.formattedTime}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderDeviceScreen = () => {
    const onlineCount = areas.filter((a) => a.online).length;
    const offlineCount = areas.length - onlineCount;

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader
          title="Quản lý thiết bị"
          rightElement={
            <TouchableOpacity
              style={styles.addDeviceBtn}
              onPress={() =>
                Alert.alert(
                  "Thông báo",
                  "Chức năng quét mã QR / Thêm thiết bị mới.",
                )
              }
            >
              <Ionicons name="add" size={22} color="#2196F3" />
            </TouchableOpacity>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.overviewCard}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewNum}>{areas.length}</Text>
              <Text style={styles.overviewLabel}>Tổng thiết bị</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewNum, { color: "#16A34A" }]}>
                {onlineCount}
              </Text>
              <Text style={styles.overviewLabel}>Đang hoạt động</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewNum, { color: "#DC2626" }]}>
                {offlineCount}
              </Text>
              <Text style={styles.overviewLabel}>Ngoại tuyến</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Danh sách Hub cảm biến</Text>

          {areas.map((area) => (
            <View key={area.id} style={styles.deviceDetailedCard}>
              <View style={styles.deviceCardHeader}>
                <View style={styles.deviceTitleRow}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={22}
                    color="#2196F3"
                  />
                  <Text style={styles.deviceCardName}>{area.name}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadgeSmall,
                    { backgroundColor: area.online ? "#D1FAE5" : "#FEE2E2" },
                  ]}
                >
                  <View
                    style={[
                      styles.dotStatus,
                      { backgroundColor: area.online ? "#10B981" : "#EF4444" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeTextSmall,
                      { color: area.online ? "#047857" : "#B91C1C" },
                    ]}
                  >
                    {area.online ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <View style={styles.deviceDetailBody}>
                <View style={styles.deviceInfoItem}>
                  <Text style={styles.deviceInfoLabel}>Mã định danh (ID):</Text>
                  <Text style={styles.deviceInfoVal}>{area.deviceCode}</Text>
                </View>
                <View style={styles.deviceInfoItem}>
                  <Text style={styles.deviceInfoLabel}>Tín hiệu Wi-Fi:</Text>
                  <Text style={styles.deviceInfoVal}>{area.wifiSignal}</Text>
                </View>
                <View style={styles.deviceInfoItem}>
                  <Text style={styles.deviceInfoLabel}>Địa chỉ IP:</Text>
                  <Text style={styles.deviceInfoVal}>{area.ipAddress}</Text>
                </View>
              </View>

              <View style={styles.deviceCardFooter}>
                <TouchableOpacity
                  style={styles.deviceActionBtn}
                  onPress={() =>
                    Alert.alert(
                      "Cấu hình thiết bị",
                      `Đang khởi động lại ${area.deviceCode}...`,
                    )
                  }
                >
                  <Ionicons name="refresh-outline" size={16} color="#4B5563" />
                  <Text style={styles.deviceActionText}>Khởi động lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deviceActionBtn}
                  onPress={() => {
                    setSelectedArea(area);
                    setCurrentScreen("areaDetail");
                  }}
                >
                  <Ionicons
                    name="stats-chart-outline"
                    size={16}
                    color="#2196F3"
                  />
                  <Text style={[styles.deviceActionText, { color: "#2196F3" }]}>
                    Xem thông số
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSettingScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Cài đặt tài khoản" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color="#2196F3" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Lê Văn An</Text>
            <Text style={styles.profileEmail}>
              {email ? email : "an.levan@firealert.vn"}
            </Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>Chủ hộ / Admin</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cài đặt thông báo & Cảnh báo</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#2196F3"
              />
              <Text style={styles.settingRowText}>Thông báo đẩy (Push)</Text>
            </View>
            <Switch
              value={pushNotification}
              onValueChange={setPushNotification}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={pushNotification ? "#2196F3" : "#F3F4F6"}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="volume-high-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Âm thanh còi báo động</Text>
            </View>
            <Switch
              value={soundAlert}
              onValueChange={(val) => {
                setSoundAlert(val);
                if (!val) stopAlarmSound();
              }}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={soundAlert ? "#2196F3" : "#F3F4F6"}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="flame-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Cảnh báo rò rỉ Khí Gas</Text>
            </View>
            <Switch
              value={gasNotification}
              onValueChange={setGasNotification}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={gasNotification ? "#2196F3" : "#F3F4F6"}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cấu hình liên hệ khẩn cấp</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() => Linking.openURL("tel:114")}
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="call-outline" size={20} color="#DC2626" />
              <Text style={styles.settingRowText}>Tổng đài cứu hộ PCCC</Text>
            </View>
            <Text style={styles.settingValText}>114</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() => {
              setTempPhoneInput(emergencyPhone);
              setIsPhoneModalVisible(true);
            }}
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="people-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>SĐT Người thân khẩn cấp</Text>
            </View>
            <View style={styles.rowRightWithChevron}>
              <Text style={styles.settingValText}>{emergencyPhone}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Bảo mật & Trợ giúp</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() => Alert.alert("Bảo mật", "Màn hình đổi mật khẩu")}
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() =>
              Alert.alert("Hướng dẫn", "Mở tài liệu hướng dẫn sử dụng hệ thống")
            }
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Trợ giúp & Hướng dẫn</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingRowClickable}>
            <View style={styles.settingRowLeft}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#2196F3"
              />
              <Text style={styles.settingRowText}>Phiên bản ứng dụng</Text>
            </View>
            <Text style={styles.settingValText}>v1.0.4</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutFullButton}
          onPress={() => setIsLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
          <Text style={styles.logoutFullText}>Đăng xuất khỏi ứng dụng</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );

  const BottomNavigation = () => (
    <View style={styles.bottomMenu}>
      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => {
          setSelectedArea(null);
          setCurrentScreen("home");
        }}
      >
        <Ionicons
          name={
            currentScreen === "home" || currentScreen === "areaDetail"
              ? "home"
              : "home-outline"
          }
          size={24}
          color={
            currentScreen === "home" || currentScreen === "areaDetail"
              ? "#2196F3"
              : "#222"
          }
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => setCurrentScreen("history")}
      >
        <Ionicons
          name={currentScreen === "history" ? "time" : "time-outline"}
          size={24}
          color={currentScreen === "history" ? "#2196F3" : "#222"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => setCurrentScreen("device")}
      >
        <Ionicons
          name={
            currentScreen === "device"
              ? "hardware-chip"
              : "hardware-chip-outline"
          }
          size={24}
          color={currentScreen === "device" ? "#2196F3" : "#222"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => setCurrentScreen("setting")}
      >
        <Ionicons
          name={currentScreen === "setting" ? "settings" : "settings-outline"}
          size={24}
          color={currentScreen === "setting" ? "#2196F3" : "#222"}
        />
      </TouchableOpacity>
    </View>
  );

  if (!isLoggedIn) {
    return (
      <LoginScreen
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
      />
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />
      {currentScreen === "home" && renderAreaListScreen()}
      {currentScreen === "areaDetail" && renderAreaDetailScreen()}
      {currentScreen === "history" && renderHistoryScreen()}
      {currentScreen === "device" && renderDeviceScreen()}
      {currentScreen === "setting" && renderSettingScreen()}

      <BottomNavigation />

      {/* Modal Báo Cháy SOS */}
      <Modal
        visible={isSosModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSosModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.sosBadge}>
              <Text style={styles.sosBadgeText}>SOS</Text>
            </View>

            <Text style={styles.modalTitle}>Xác nhận báo cháy</Text>
            <Text style={styles.modalMessage}>
              Hệ thống sẽ thực hiện cuộc gọi khẩn cấp đến SĐT người thân (
              {emergencyPhone}).
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsSosModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmSOS}
              >
                <Text style={styles.modalConfirmText}>Gọi ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal SĐT Khẩn cấp */}
      <Modal
        visible={isPhoneModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPhoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SĐT Khẩn Cấp</Text>
            <Text style={styles.modalMessage}>
              Nhập số điện thoại sẽ tự động gọi khi kích hoạt SOS.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tempPhoneInput}
              onChangeText={setTempPhoneInput}
              keyboardType="phone-pad"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsPhoneModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSavePhone}
              >
                <Text style={styles.modalConfirmText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Đăng xuất */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đăng xuất</Text>
            <Text style={styles.modalMessage}>
              Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: "#DC2626" }]}
                onPress={handleLogout}
              >
                <Text style={styles.modalConfirmText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =====================================================
// STYLESHEET
// =====================================================
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 40,
  },
  screenContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFF",
  },
  logoWrapper: {
    alignItems: "center",
    marginBottom: 10,
  },
  loginLogo: {
    width: 100,
    height: 100,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#DC2626",
    marginBottom: 24,
  },
  loginInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotText: {
    color: "#2196F3",
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerNormal: {
    color: "#6B7280",
  },
  registerText: {
    color: "#2196F3",
    fontWeight: "bold",
    marginLeft: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  areaCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  areaCardIcon: {
    marginRight: 16,
  },
  areaCardInfo: {
    flex: 1,
  },
  areaCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  areaCardSubText: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusBannerText: {
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },
  sosSentBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: "#FEE2E2",
  },
  sosSentText: {
    color: "#DC2626",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },
  sensorBox: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sensorName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#374151",
  },
  sensorValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#111827",
  },
  fireBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  fireBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 16,
  },
  historyCard: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  historyTitle: {
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 6,
    color: "#111827",
  },
  historyDetail: {
    color: "#4B5563",
    fontSize: 14,
    marginBottom: 4,
  },
  historyTime: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  addDeviceBtn: {
    padding: 6,
  },
  overviewCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  overviewItem: {
    alignItems: "center",
  },
  overviewNum: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  overviewLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  overviewDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    marginVertical: 10,
  },
  deviceDetailedCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deviceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  deviceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  deviceCardName: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#111827",
  },
  statusBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dotStatus: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeTextSmall: {
    fontSize: 12,
    fontWeight: "bold",
  },
  deviceDetailBody: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
  },
  deviceInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  deviceInfoLabel: {
    color: "#6B7280",
    fontSize: 13,
  },
  deviceInfoVal: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "500",
  },
  deviceCardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  deviceActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  deviceActionText: {
    fontSize: 13,
    color: "#4B5563",
    marginLeft: 4,
  },
  profileCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: {
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  profileEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: "#EFF6FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  roleTagText: {
    color: "#2196F3",
    fontSize: 12,
    fontWeight: "bold",
  },
  settingsGroup: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingRowClickable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingRowText: {
    fontSize: 15,
    marginLeft: 10,
    color: "#374151",
  },
  settingValText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  rowRightWithChevron: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutFullButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  logoutFullText: {
    color: "#DC2626",
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 8,
  },
  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: "#FFF",
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  bottomButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  sosBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  sosBadgeText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  modalCancelText: {
    color: "#374151",
    fontWeight: "bold",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
