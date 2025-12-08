
      <View className="mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
        <Text className="text-center text-xs" style={{ color: colors['muted-foreground'] }}>
          Weave • Social Relationship Management
        </Text>
      </View>

      <TrophyCabinetModal
        visible={showTrophyCabinet}
        onClose={() => setShowTrophyCabinet(false)}
      />

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      <ArchetypeLibrary
        isVisible={showArchetypeLibrary}
        onClose={() => setShowArchetypeLibrary(false)}
      />

      <FriendManagementModal
        visible={showFriendManagement}
        onClose={() => setShowFriendManagement(false)}
      />


    </CustomBottomSheet>
  );
}