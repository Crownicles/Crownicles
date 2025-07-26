import React, {createContext, ReactNode, useContext, useState} from "react";

interface ProfileData {
  pseudo: string;
  classId?: number;
}

interface ProfileContextType {
  profileData: ProfileData;
  setProfileData: (data: ProfileData) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profileData, setProfileData] = useState<ProfileData>({
    pseudo: "Profile"
  });

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
