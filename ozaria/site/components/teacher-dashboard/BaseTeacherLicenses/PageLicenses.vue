
<script>
import LicenseCard from './common/LicenseCard'
import PrimaryButton from '../common/buttons/PrimaryButton'
import { mapGetters } from 'vuex'
import ButtonResourceIcon from '../BaseResourceHub/components/ButtonResourceIcon'

export default {
  components: {
    LicenseCard,
    PrimaryButton,
    ButtonResourceIcon
  },
  props: {
    activeLicenses: {
      type: Array,
      required: true,
      default: () => []
    },
    expiredLicenses: {
      type: Array,
      required: true,
      default: () => []
    },
    teacherId: {
      type: String,
      required: true
    },
    displayOnly: { // sent from DSA
      type: Boolean,
      default: false
    }
  },
  computed: {
    ...mapGetters({
      getUserById: 'users/getUserById',
      getTrackCategory: 'teacherDashboard/getTrackCategory'
    }),
    howToLicensesResourceData () {
      return {
        icon: 'Slides',
        label: 'How To: Manage Licenses',
        link: 'https://docs.google.com/presentation/d/1SfM5ZMjae8wm8HESHoXXO0wBnKJmJD53BgtG9XwVW9k/edit?usp=sharing'
      }
    },
    showGetTestLicense () {
      const testStudentRelation = (me.get('related') || []).filter(related => related.relation === 'TestStudent')[0]
      if (!testStudentRelation) {
        return false
      }
      const testLicense = _.find(this.activeLicenses, (prepaid) => prepaid.properties?.testStudentOnly)
      return !testLicense
    }
  },
  methods: {
    trackEvent (eventName) {
      if (eventName) {
        window.tracker?.trackEvent(eventName, { category: this.getTrackCategory })
      }
    }
  }
}
</script>

<template>
  <div class="licenses-page">
    <div class="side-bar">
      <span class="side-bar-title"> {{ $t("common.help") }} </span>
      <div class="side-bar-text">
        {{ $t('teacher_dashboard.license_questions') }}
      </div>
      <button-resource-icon
        class="pdf-btn"
        :icon="howToLicensesResourceData.icon"
        :label="howToLicensesResourceData.label"
        :link="howToLicensesResourceData.link"
        :track-category="getTrackCategory"
        from="My Licenses"
      />
      <div class="side-bar-text">
        {{ $t('teacher_dashboard.need_more_licenses') }}
      </div>
      <primary-button
        class="get-licenses-btn"
        :inactive="displayOnly"
        @click="$emit('getLicenses')"
        @click.native="trackEvent('My Licenses: Get More Licenses Clicked')"
      >
        {{ $t("courses.get_enrollments") }}
      </primary-button>
      <primary-button
        v-if="showGetTestLicense"
        class="get-test-license"
        @click="$emit('getTestLicense', { teacherId } )"
        @click.native="trackEvent('My Licenses: Get Test Student Licenses Clicked')"
      >
        {{ $t('courses.get_test_license') }}
      </primary-button>
      <div class="side-bar-text">
        {{ $t('teacher_dashboard.see_also_our') }} <a href="/funding">{{ $t('nav.funding_resources_guide') }}</a> {{ $t('teacher_dashboard.for_more_funding_resources') }}
      </div>
    </div>
    <div class="license-cards">
      <div
        v-if="activeLicenses.length > 0"
        class="active-licenses row"
      >
        <span class="col-md-12"> {{ $t("teacher_licenses.active_licenses") }} </span>
        <license-card
          v-for="license in activeLicenses"
          :key="license._id"
          class="card col-md-2"
          :display-only="displayOnly"
          :total="license.maxRedeemers"
          :used="(license.redeemers || []).length"
          :start-date="license.startDate"
          :end-date="license.endDate"
          :owner="getUserById(license.creator)"
          :teacher-id="teacherId"
          :properties="license.properties"
          :included-course-ids="license.includedCourseIDs"
          @apply="$emit('apply')"
          @share="$emit('share', license)"
          @stats="$emit('stats', license)"
        />
      </div>
      <div
        v-if="expiredLicenses.length > 0"
        class="expired-licenses row"
      >
        <span class="col-md-12"> {{ $t("teacher_licenses.expired_licenses") }} </span>
        <license-card
          v-for="license in expiredLicenses"
          :key="license._id"
          class="card col-md-2"
          :display-only="displayOnly"
          :total="license.maxRedeemers"
          :used="(license.redeemers || []).length"
          :start-date="license.startDate"
          :end-date="license.endDate"
          :owner="getUserById(license.creator)"
          :teacher-id="teacherId"
          :properties="license.properties"
          :included-course-ids="license.includedCourseIDs"
          :expired="true"
          @stats="$emit('stats', license)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "app/styles/bootstrap/variables";
@import "ozaria/site/styles/common/variables.scss";
@import "app/styles/ozaria/_ozaria-style-params.scss";

.licenses-page {
  display: flex;
}

.side-bar {
  background: #F2F2F2;
  box-shadow: -1px 0px 1px rgba(0, 0, 0, 0.06), 3px 0px 8px rgba(0, 0, 0, 0.15);
  width: 20%;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  margin-top: 3px;
}

.side-bar-title {
  @include font-h-4-nav-uppercase-black;
}

.side-bar-text {
  @include font-p-3-paragraph-small-gray;
  color: $pitch;
  margin: 15px 0px;
}

.pdf-btn {
  align-self: center;
  margin: 10px 0px;
}

.get-licenses-btn, .get-test-license {
  width: 100%;
  max-width: 220px;
  height: 50px;
  margin: 20px 0px;
}

.license-cards {
  width: 80%;
  padding: 30px 0px;
}

.active-licenses, .expired-licenses {
  margin: 0px 20px 30px 20px;
  span {
    @include font-h-5-button-text-black;
    color: $twilight;
    text-align: left;
  }
}
.card  {
  margin: 10px;
}
</style>
