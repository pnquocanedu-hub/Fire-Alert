import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";
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
} from "react-native";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

function LoginScreen({ email, setEmail, password, setPassword, handleLogin }) {
  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" />
      <Image
        source={require("./assets/logo-removebg-preview.png")}
        style={styles.loginLogo}
        resizeMode="contain"
      />
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
        <TouchableOpacity onPress={() => Alert.alert("Thông báo", "Màn hình đăng ký.")}>
          <Text style={styles.registerText}>Đăng ký</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("home"); // "home" | "history" | "device" | "setting" | "areaDetail"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // TÍCH HỢP THỜI GIAN THỰC (Đồng hồ chạy từng giây)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString("vi-VN"));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modal SOS & Trạng thái gửi SOS
  const [isSosModalVisible, setIsSosModalVisible] = useState(false);

  // Danh sách các khu vực
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
    },
    {
      id: "ESP32_004",
      name: "Phòng ngủ 2",
      deviceCode: "ESP32_004",
      icon: "bed-outline",
      gas: 0,
      temperature: 27,
      flame: false,
      online: true,
      statusType: "normal",
      statusText: "An toàn",
      sosSent: false,
    },
  ]);

  const [selectedArea, setSelectedArea] = useState(null);
  const [historyData, setHistoryData] = useState([]);

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

  // Lắng nghe Realtime Database cho khu vực chính (Nhà bếp / ESP32_002)
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
          if (area.deviceCode === "ESP32_002" || area.deviceCode === "ESP32_001") {
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

  const ScreenHeader = ({ title, showBack = false }) => {
    return (
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
      </View>
    );
  };

  // =====================================================
  // 1. MÀN HÌNH DANH SÁCH KHU VỰC (NHÀ)
  // =====================================================
  const AreaListScreen = () => {
    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Nhà" />
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
  };

  // =====================================================
  // 2. MÀN HÌNH CHI TIẾT KHU VỰC
  // =====================================================
  const AreaDetailScreen = () => {
    if (!selectedArea) return null;

    const currentArea = areas.find((a) => a.id === selectedArea.id) || selectedArea;

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title={currentArea.name} showBack={true} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* BANNER TÍN HIỆU SOS ĐÃ GỬI */}
          {currentArea.sosSent && (
            <View style={styles.sosSentBanner}>
              <Ionicons name="notifications" size={20} color="#DC2626" />
              <Text style={styles.sosSentText}>Đã gửi tín hiệu SOS</Text>
            </View>
          )}

          {/* BANNER TRẠNG THÁI */}
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

          {/* CÁC DÒNG THÔNG SỐ CẢM BIẾN */}
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
                {currentArea.deviceCode} {currentArea.online ? "online" : "offline"}
              </Text>
            </View>

            {/* THỜI GIAN THỰC ĐƯỢC HIỂN THỊ TẠI ĐÂY */}
            <View style={styles.sensorRow}>
              <Ionicons name="time" size={20} color="#222" />
              <Text style={styles.sensorName}>Thời gian</Text>
              <Text style={styles.sensorValue}>{currentTime}</Text>
            </View>
          </View>

          {/* NÚT BÁO CHÁY Red Button */}
          <TouchableOpacity
            style={styles.fireBtn}
            onPress={() => setIsSosModalVisible(true)}
          >
            <Text style={styles.fireBtnText}>Báo cháy</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* MODAL XÁC NHẬN BÁO CHÁY SOS */}
        <Modal
          visible={isSosModalVisible}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.sosBadge}>
                <Text style={styles.sosBadgeText}>SOS</Text>
              </View>

              <Text style={styles.modalTitle}>Xác nhận báo cháy</Text>
              <Text style={styles.modalMessage}>
                Bạn có chắc chắn muốn gửi yêu cầu SOS?{"\n"}Hệ thống sẽ gửi cảnh báo đến người liên hệ cứu hộ/ người phụ trách.
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
      </View>
    );
  };

  // =====================================================
  // 3. CÁC MÀN HÌNH KHÁC
  // =====================================================
  const HistoryScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Lịch sử" />
      <ScrollView>
        {historyData.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
            <Text>Gas: {item.gas} ppm | Nhiệt độ: {item.temperature} °C</Text>
            <Text style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Thời gian: {item.formattedTime}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const DeviceScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Thiết bị" />
      <ScrollView>
        {areas.map((area) => (
          <View key={area.id} style={styles.deviceRow}>
            <Text style={{ fontSize: 16 }}>{area.name} ({area.deviceCode})</Text>
            <Text style={{ color: "#16A34A" }}>{area.online ? "Online" : "Offline"}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const SettingScreen = () => (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Tài khoản" />
      <ScrollView>
        <TouchableOpacity style={styles.logoutButton} onPress={() => setIsLoggedIn(false)}>
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
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
          name={currentScreen === "home" || currentScreen === "areaDetail" ? "home" : "home-outline"}
          size={24}
          color={currentScreen === "home" || currentScreen === "areaDetail" ? "#2196F3" : "#222"}
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
          name={currentScreen === "device" ? "hardware-chip" : "hardware-chip-outline"}
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
      {currentScreen === "home" && <AreaListScreen />}
      {currentScreen === "areaDetail" && <AreaDetailScreen />}
      {currentScreen === "history" && <HistoryScreen />}
      {currentScreen === "device" && <DeviceScreen />}
      {currentScreen === "setting" && <SettingScreen />}

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
  loginLogo: { width: 160, height: 160, marginBottom: 4 },
  loginTitle: { fontSize: 35, fontWeight: "bold", color: "#D71920", marginBottom: 38 },
  loginInput: {
    width: "100%",
    height: 55,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 3,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 15,
  },
  forgotButton: { width: "100%", alignItems: "flex-end", marginBottom: 18 },
  forgotText: { fontSize: 11, color: "#333" },
  loginButton: {
    width: "100%",
    height: 47,
    backgroundColor: "#E00000",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  registerContainer: { flexDirection: "row", marginTop: 48 },
  registerNormal: { fontSize: 11, color: "#555", marginRight: 5 },
  registerText: { fontSize: 11, color: "#D71920", fontWeight: "500" },

  mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  screenContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 70,
  },
  header: { marginBottom: 20 },
  headerBackBtn: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#111111" },

  // CARD DANH SÁCH KHU VỰC
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

  // BANNER CHI TIẾT
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
  sosSentText: { fontSize: 15, fontWeight: "bold", color: "#DC2626", marginLeft: 8 },

  // CẢM BIẾN
  sensorBox: { marginBottom: 30 },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sensorName: { fontSize: 15, color: "#111", marginLeft: 12, flex: 1 },
  sensorValue: { fontSize: 15, color: "#111", fontWeight: "500" },

  // NÚT BÁO CHÁY
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

  // MODAL SOS
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
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#111", marginBottom: 10 },
  modalMessage: { fontSize: 13, color: "#666", textAlign: "center", lineHeight: 18, marginBottom: 22 },
  modalBtnRow: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
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

  // MÀN HÌNH KHÁC
  historyCard: { padding: 14, borderWidth: 1, borderColor: "#EEE", borderRadius: 10, marginBottom: 10 },
  deviceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  logoutButton: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  logoutText: { fontSize: 15, color: "#DC2626", fontWeight: "bold", marginLeft: 12 },

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