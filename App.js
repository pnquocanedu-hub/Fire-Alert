import React, { useState, useEffect } from "react";
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
} from "react-native";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { Ionicons } from "@expo/vector-icons";

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

  // Đồng hồ thời gian thực
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleString("vi-VN")
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trạng thái Modal SOS & Modal Logout
  const [isSosModalVisible, setIsSosModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  // Cài đặt ứng dụng (Trạng thái Switch)
  const [pushNotification, setPushNotification] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [gasNotification, setGasNotification] = useState(true);

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
      gas: 1200,
      temperature: 26,
      flame: false,
      online: true,
      statusType: "gas",
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
      online: true,
      statusType: "normal",
      statusText: "An toàn",
      sosSent: false,
      wifiSignal: "Trung bình (55%)",
      ipAddress: "192.168.1.103",
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

  // Realtime Database listener
  useEffect(() => {
    if (!isLoggedIn) return;

    const systemRef = ref(rtdb, "HeThong");
    const unsubscribe = onValue(systemRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const sensor = data.ThongSo_CamBien ?? {};
      const device = data.TinhTrang_ThietBi ?? {};

      setAreas((prevAreas) =>
        prevAreas.map((area) => {
          if (
            area.deviceCode === "ESP32_002" ||
            area.deviceCode === "ESP32_001"
          ) {
            const gasVal = sensor.NongDo_Gas_ADC ?? area.gas;
            const tempVal = sensor.NhietDo_C ?? area.temperature;
            const flameVal = sensor.PhatHienLua ?? area.flame;
            const isOnline = device.ESP32 === "Online";

            let sType = "normal";
            let sText = "An toàn";

            if (flameVal || (tempVal > 55 && gasVal > 1000)) {
              sType = "fire";
              sText = "Cảnh báo cháy";
            } else if (gasVal >= 300) {
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
        })
      );
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Firestore History listener
  useEffect(() => {
    if (!isLoggedIn) return;

    const q = query(
      collection(db, "alert_history"),
      orderBy("timestamp", "desc"),
      limit(50)
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

  // Xử lý xác nhận SOS
  const handleConfirmSOS = () => {
    setIsSosModalVisible(false);
    if (selectedArea) {
      setAreas((prev) =>
        prev.map((item) =>
          item.id === selectedArea.id ? { ...item, sosSent: true } : item
        )
      );
      setSelectedArea((prev) => (prev ? { ...prev, sosSent: true } : null));
    }
    Linking.openURL("tel:0979060405");
  };

  const handleLogout = () => {
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

  // Màn hình danh sách khu vực
  const renderAreaListScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Trang chủ" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {areas.map((area) => {
          let cardBg = "#DDF7E3";
          let iconColor = "#2E7D32";

          if (area.statusType === "gas") {
            cardBg = "#FFE8A3";
            iconColor = "#D97706";
          } else if (area.statusType === "fire") {
            cardBg = "#FFD8D8";
            iconColor = "#DC2626";
          }

          return (
            <TouchableOpacity
              key={area.id}
              style={[styles.areaCard, { backgroundColor: cardBg }]}
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
                <Text style={styles.areaCardSubText}>{area.statusText}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Màn hình chi tiết khu vực
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
              <Ionicons name="flame" size={20} color="#DC2626" />
              <Text style={styles.sensorName}>Ngọn lửa</Text>
              <Text style={styles.sensorValue}>
                {currentArea.flame ? "Có" : "Không"}
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
            <Ionicons name="checkmark-circle-outline" size={60} color="#16A34A" />
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
              <Text style={styles.historyTime}>Thời gian: {item.formattedTime}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  // =====================================================
  // MÀN HÌNH THIẾT BỊ (ĐÃ NÂNG CẤP CHI TIẾT)
  // =====================================================
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
              onPress={() => Alert.alert("Thông báo", "Chức năng quét mã QR / Thêm thiết bị mới.")}
            >
              <Ionicons name="add" size={22} color="#2196F3" />
            </TouchableOpacity>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Thống kê tổng quan */}
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
                      `Đang khởi động lại ${area.deviceCode}...`
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
                  <Ionicons name="stats-chart-outline" size={16} color="#2196F3" />
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

  // =====================================================
  // MÀN HÌNH TÀI KHOẢN (ĐÃ NÂNG CẤP CHI TIẾT)
  // =====================================================
  const renderSettingScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Cài đặt tài khoản" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Thẻ User Profile */}
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

        {/* Nhóm Cài đặt thông báo */}
        <Text style={styles.sectionTitle}>Cài đặt thông báo & Cảnh báo</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="notifications-outline" size={20} color="#2196F3" />
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
              onValueChange={setSoundAlert}
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

        {/* Nhóm Liên hệ khẩn cấp */}
        <Text style={styles.sectionTitle}>Cấu hình liên hệ khẩn cấp</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() => Alert.alert("Cứu hộ 114", "Số cứu hộ mặc định: 114")}
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="call-outline" size={20} color="#DC2626" />
              <Text style={styles.settingRowText}>Tổng đài cứu hộ PCCC</Text>
            </View>
            <Text style={styles.settingValText}>114</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() =>
              Alert.alert("Chỉnh sửa", "Thay đổi số điện thoại người thân khẩn cấp")
            }
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="people-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>SĐT Người thân khẩn cấp</Text>
            </View>
            <View style={styles.rowRightWithChevron}>
              <Text style={styles.settingValText}>0979060405</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Nhóm Bảo mật & Hệ thống */}
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
            onPress={() => Alert.alert("Hướng dẫn", "Mở tài liệu hướng dẫn sử dụng hệ thống")}
          >
            <View style={styles.settingRowLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Trợ giúp & Hướng dẫn</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingRowClickable}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
              <Text style={styles.settingRowText}>Phiên bản ứng dụng</Text>
            </View>
            <Text style={styles.settingValText}>v1.0.4</Text>
          </View>
        </View>

        {/* Nút Đăng xuất */}
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
      {currentScreen === "home" && renderAreaListScreen()}
      {currentScreen === "areaDetail" && renderAreaDetailScreen()}
      {currentScreen === "history" && renderHistoryScreen()}
      {currentScreen === "device" && renderDeviceScreen()}
      {currentScreen === "setting" && renderSettingScreen()}

      {/* Modal báo cháy cố định cấp cao nhất */}
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
              Bạn có chắc chắn muốn gửi yêu cầu SOS?{"\n"}Hệ thống sẽ gửi cảnh
              báo đến người liên hệ cứu hộ/ người phụ trách.
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
                <Text style={styles.modalConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal xác nhận Đăng xuất */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="log-out-outline" size={40} color="#DC2626" />
            <Text style={[styles.modalTitle, { marginTop: 10 }]}>
              Đăng xuất
            </Text>
            <Text style={styles.modalMessage}>
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleLogout}
              >
                <Text style={styles.modalConfirmText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavigation />
    </View>
  );
}

// =====================================================
// STYLESHEET
// =====================================================
const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingHorizontal: 38,
    paddingTop: 70,
  },
  logoWrapper: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  loginLogo: { width: "100%", height: "100%" },
  loginTitle: {
    fontSize: 35,
    fontWeight: "bold",
    color: "#D71920",
    marginBottom: 38,
  },
  loginInput: {
    width: "100%",
    height: 55,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 15,
    backgroundColor: "#FAFAFA",
  },
  forgotButton: { width: "100%", alignItems: "flex-end", marginBottom: 18 },
  forgotText: { fontSize: 12, color: "#333" },
  loginButton: {
    width: "100%",
    height: 47,
    backgroundColor: "#E00000",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  registerContainer: { flexDirection: "row", marginTop: 48 },
  registerNormal: { fontSize: 12, color: "#555", marginRight: 5 },
  registerText: { fontSize: 12, color: "#D71920", fontWeight: "500" },

  mainContainer: { flex: 1, backgroundColor: "#F9FAFB" },
  screenContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 70,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerBackBtn: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#111827" },

  areaCard: {
    width: "100%",
    height: 65,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  areaCardIcon: { marginRight: 14 },
  areaCardInfo: { flex: 1 },
  areaCardTitle: { fontSize: 15, fontWeight: "bold", color: "#111" },
  areaCardSubText: { fontSize: 13, color: "#444", marginTop: 2 },

  statusBanner: {
    width: "100%",
    height: 55,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  statusBannerText: { fontSize: 18, fontWeight: "bold", marginLeft: 8 },

  sosSentBanner: {
    width: "100%",
    height: 48,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  sosSentText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#DC2626",
    marginLeft: 8,
  },

  sensorBox: { backgroundColor: "#FFF", borderRadius: 12, padding: 10, marginBottom: 30 },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sensorName: { fontSize: 15, color: "#111", marginLeft: 12, flex: 1 },
  sensorValue: { fontSize: 15, color: "#111", fontWeight: "500" },

  fireBtn: {
    width: "100%",
    height: 52,
    backgroundColor: "#D71920",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  fireBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

  // STYLES MÀN HÌNH THIẾT BỊ NÂNG CẤP
  addDeviceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  overviewCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  overviewItem: { flex: 1, alignItems: "center" },
  overviewNum: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  overviewLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  overviewDivider: { width: 1, backgroundColor: "#E5E7EB" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 10,
    marginTop: 6,
  },
  deviceDetailedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deviceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
  },
  deviceTitleRow: { flexDirection: "row", alignItems: "center" },
  deviceCardName: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginLeft: 8 },
  statusBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dotStatus: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusBadgeTextSmall: { fontSize: 12, fontWeight: "600" },

  deviceDetailBody: { paddingVertical: 10 },
  deviceInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  deviceInfoLabel: { fontSize: 13, color: "#6B7280" },
  deviceInfoVal: { fontSize: 13, fontWeight: "500", color: "#374151" },

  deviceCardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
    marginTop: 4,
  },
  deviceActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  deviceActionText: { fontSize: 13, color: "#4B5563", marginLeft: 4, fontWeight: "500" },

  // STYLES MÀN HÌNH TÀI KHOẢN NÂNG CẤP
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: { marginRight: 14 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  profileEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  roleTag: {
    backgroundColor: "#EFF6FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  roleTagText: { fontSize: 11, color: "#2196F3", fontWeight: "600" },

  settingsGroup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
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
  settingRowLeft: { flexDirection: "row", alignItems: "center" },
  settingRowText: { fontSize: 14, color: "#374151", marginLeft: 12, fontWeight: "500" },
  settingValText: { fontSize: 14, color: "#6B7280" },
  rowRightWithChevron: { flexDirection: "row", alignItems: "center" },

  logoutFullButton: {
    flexDirection: "row",
    backgroundColor: "#FEE2E2",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  logoutFullText: { color: "#DC2626", fontWeight: "bold", fontSize: 15, marginLeft: 8 },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  sosBadge: {
    width: 50,
    height: 28,
    backgroundColor: "#DC2626",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sosBadgeText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 22,
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  modalCancelText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { color: "#FFF", fontWeight: "600", fontSize: 14 },

  historyCard: {
    backgroundColor: "#FFF",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 10,
  },
  historyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  historyTitle: { fontWeight: "bold", marginLeft: 8, fontSize: 15, color: "#111827" },
  historyDetail: { fontSize: 13, color: "#4B5563" },
  historyTime: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#6B7280", marginTop: 10, fontSize: 15 },

  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  bottomButton: { flex: 1, justifyContent: "center", alignItems: "center" },
});