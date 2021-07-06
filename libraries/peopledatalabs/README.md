# field descriptions

id  String  PDL persistent ID qEnOZ5Oh0poWnQ1luFBfVw_0000
full_name String  The first and the last name fields appended with a space  sean thorne
first_name  String  A person's first name sean
middle_initial  String  A person's middle initial f
middle_name String  A person's middle name  fong
last_name String  A person's last name  thorne
gender  String  The person's gender male
birth_year  String  Approximated birth date associated with this person profile. If a profile has a birth_date, the birth_data_fuzzy field will match 1990
birth_date  String  Birth date associated with this person profile  1990-12-03
linkedin_url  String  Main linkedin profile for this record based on source agreement linkedin.com/in/seanthorne
linkedin_username String  Main linkedin username for this record based on source agreement  seanthorne
linkedin_id String  Main linkedin profile id for this record based on source agreement  145991517
facebook_url  String  facebook profile  facebook.com/deseanthorne
facebook_username String  facebook username deseanthorne
facebook_id String  persistent facebook id associated with a person's facebook profile  1089351304
twitter_url String  Twitter URL twitter.com/seanthorne5
twitter_username  String  Twitter Username  seanthorne5
github_url  String  Main github profile for this record based on source agreement github.com/deseanathan_thornolotheu
github_username String  Main github profile username for this record based on source agreement  deseanathan_thornolotheu
work_email  String  Current Professional email  sean@peopledatalabs.com
personal_emails List (String) List of all emails tagged as type = personal  ["sean@gmail.com", "sthorne5@yahoo.com"]
mobile_phone  String  Highly confident direct dial mobile phone associated with this person +17095944554
industry  Enum (String) The most relevant industry for this record based primarily on their tagged personal industries and secondarily on the industries of the companies that they have worked for computer software
job_title String  A person's current job title  co-founder and chief executive officer
job_title_role  Enum (String) A person's current job title derived role operations
job_title_sub_role  Enum (String) A person's job title derived subrole. Each subrole maps to a role logistics
job_title_levels  String  A person's current job title derived levels ["cxo", "owner"]
job_company_id  String  A person's current company's PDL ID peopledatalabs
job_company_name  String  A person's current company's name people data labs
job_company_website String  A person's current company's website  peopledatalabs.com
job_company_size  String  A person's current company's size range 51-200
job_company_founded String  A person's current company's founded date 1911
job_company_industry  Enum (String) A person's current company's industry computer software
job_company_linkedin_url  String  A person's current company's linkedin url linkedin.com/company/peopledatalabs
job_company_linkedin_id String  A person's current company's linkedin id  1640694639
job_company_facebook_url  String  A person's current company's facebook url facebook.com/peopledatalabs
job_company_twitter_url String  A person's current company's twitter url  twitter.com/peopledatalabs
job_company_location_name String  A person's current company's HQ canonical location  san francisco, california, united states
job_company_location_locality String  A person's current company's HQ locality  san francisco
job_company_location_metro  String  A person's current company's HQ metro area  san francisco, california
job_company_location_region String  A person's current company's HQ region  california
job_company_location_geo  String  A person's current company's HQ geo 37.77,-122.41
job_company_location_street_address String  A person's current company's HQ street_address  455 Market Street Suite 1690
job_company_location_address_line_2 String  A person's current company's HQ address line 2  suite 1690
job_company_location_postal_code  String  A person's current company's HQ postal code 94105
job_company_location_country  String  A person's current company's HQ country united states
job_company_location_continent  String  A person's current company's HQ continent north america
job_last_updated  String  Indicates the timestamp of the most recent source that agrees with this information 2018-11-05
job_start_date  String  Indicates the start period of the object. Can be accurate to the day (YYYY-MM-DD), month (YYYY-MM) or year (YYYY) 2015-03
location_name String  the current canonical location of the person  berkeley, california, united states
location_locality String  the current locality of the person  berkeley
location_metro  String  the current MSA of the person san francisco, california
location_region String  the current region of the person  california
location_country  String  the current country of the person united states
location_continent  String  the current continent of the person north america
location_street_address String  the current street address of the person  455 fake st
location_address_line_2 String  the current address line 2 of the person  apartment 12
location_postal_code  String  the current postal code of the person 94704
location_geo  String  the current geo of the person 37.87,-122.27
location_last_updated String  Indicates the timestamp of the most recent source that agrees with this information 2018-11-05
phone_numbers Array (String)  Phone numbers associated with this person profile in E164 format  +17095944554
emails  Array (Object)  Emails associated with this person profile. When outputted as a csv, the indexing is based on recency and associativity 
emails.address  String  The full parsed email sean@peopledatalabs.com
emails.type Enum (String) The type of email either current_professional, professional, personal or null professional
interests Array (Object)  Interests associated with the profile 
skills  Array (Object)  Skills associated with the profile  
location_names  List (String) list of all canonical location names associated with the person ["berkeley, california, united states", "san francisco, california, united states"]
regions Array (String)  List of regions associated with the person  ["california, united states"]
countries Array (String)  list of countries associated with a person  ["united states"]
street_addresses  Array (Object)  List of full parsed addresses associated with the person  List of full parsed addresses associated with the person
street_addresses.street_address String  The street address associated with the location object  455 fake st
street_addresses.address_line_2 String  The secondary street address associated with the location object  apartment 12
street_addresses.name String  A string that appends location fields together to create a standard location field  berkeley, california, united states
street_addresses.locality String  The administrative locality associated with the location object berkeley
street_addresses.metro  String  The metro area associated with the location object  san francisco, california
street_addresses.region String  The administrative region associated with the location object california
street_addresses.postal_code  String  The postal code associated with the location object 94704
street_addresses.country  String  The country associated with the location object united states
street_addresses.geo  String  The geolocation associated with the location object 37.87,-122.27
street_addresses.continent  Enum (String) The continent associated with the country in the location object  north america
experience  Array (Object)  Experience objects associated with this person profile. When outputted as a csv, the indexing is based on recency and associativity 
experience.title  Object  A dictionary object that provides a raw title, canonized title, and level 
experience.title.name String  The inputted title from our data sources with some basic cleaning and mapping in order to help with merging chief executive officer and co-founder
experience.title.levels Array (Enum (String)) Levels associated with a title  ["cxo"]
experience.title.role Enum (String) A person's job title derived role operations
experience.title.sub_role Enum (String) A person's job title derived subrole. Each subrole maps to a role logistics
experience.company  Object  A dictionary of information for the associated company  
experience.company.id String  Our current NOT PERSISTENT ids that tie company data to the canonical data  peopledatalabs
experience.company.name String  The name associated with the company  people data labs
experience.company.website  String  The website associated with the company peopledatalabs.com
experience.company.founded  String  The year that the company was founded 1911
experience.company.size Enum (String) The size range of the company 51-200
experience.company.industry Enum (String) The industry associated with the company  computer software
experience.company.linkedin_url String  The linkedin url associated with the company  linkedin.com/company/peopledatalabs
experience.company.linkedin_id  String  The linkedin id associated with the company 1640694639
experience.company.facebook_url String  The facebook url associated with the company  facebook.com/peopledatalabs
experience.company.twitter_url  String  The twitter associated with the company twitter.com/peopledatalabs
experience.start_date String  Indicates the start period of the object. Can be accurate to the day (YYYY-MM-DD), month (YYYY-MM) or year (YYYY) 2015-03
experience.end_date String  Indicates the end period of the object  2011-07
experience.location_names Array (String)  Canonical locations associated with this particular job/experience object (where the person is working, which may or may not be where the company is headquartered.)  ["san francisco, california, united states"]
experience.is_primary Boolean Indicates if the experience is the primary experience object in our dataset. This experience object will exist in the job_XXX fields  true
experience.company.location Object  A dictionary of information for the associated company location 
experience.company.location.street_address  String  Company HQ address  455 Market Street Suite 1690
experience.company.location.address_line_2  String  The adress line 2 associated with the company HQ  suite 1690
experience.company.location.name  String  The canonical location name associated with the company HQ  san francisco, california, united states
experience.company.location.locality  String  Company locality  san francisco
experience.company.location.metro String  Company metro area  san francisco, california
experience.company.location.region  String  Company region  california
experience.company.location.country String  Company country united states
experience.company.location.postal_code String  The postal code associated with the company HQ  94105
experience.company.location.continent String  The continent associated with the company HQ  north america
experience.company.location.geo String  The geo code associated with the company HQ 37.77,-122.41
education Array (Object)  Education objects associated with this person profile. When outputted as a csv, the indexing is based on recency and associativity  
education.degrees Array (String)  A list of canonical degrees associated with this education object ["bachelors", "bachelors of arts"]
education.majors  Array (String)  A list of majors associated with this education object  ["entrepreneurship"]
education.minors  Array (String)  A list of minors associated with this education object  ["business"]
education.school  Object  A dictionary of information for the associated school 
education.school.id String  Our current NOT PERSISTENT ids that tie company data to the canonical data  a56df063-4562-4e59-bc4c-68b33c14df1e
education.school.name Array (String)  The name associated with the school university of oregon
education.school.website  String  The website associated with the school, could include subdomains  business.uoregon.edu
education.school.domain String  The website associated with the school  uoregon.edu
education.school.type Array (String)  The type of school  post-secondary institution
education.school.linkedin_url String  The linkedin url associated with the school linkedin.com/school/university-of-oregon
education.school.linkedin_id  String  The linkedin ID associated with the school  19207
education.school.facebook_url String  The website associated with the school  The website associated with the school
education.school.twitter_url  String  The twitter url associated with the school  twitter.com/uoregon
education.school.location Object  The location associated with the school 
education.school.location.name  String  The canonical name of the location associated with the school eugene, oregon, united states
education.school.location.locality  String  The locality associated with the school eugene
education.school.location.region  String  The region associated with the school oregon
education.school.location.country String  The country associated with the school  united states
education.school.location.continent String  The continent associated with the school  north america
education.start_date  String  Indicates the start period of the object  2008-09
education.end_date  String  Indicates the end period of the object  2013-06
education.gpa Decimal The gpa associated with the given degree  2.23
profiles  Array (Object)  Social media profiles associated with this person profile 
profiles.url  String  The url of the social profile linkedin.com/in/seanthorne
profiles.id String  the persistent id related to this social profile (varies by social network) 145991517
profiles.network  Enum (String) The network the profile exists on linkedin
profiles.username String  The username associated with the profile  seanthorne
