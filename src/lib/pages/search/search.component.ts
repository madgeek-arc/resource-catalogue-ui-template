import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {Subscription, timer} from 'rxjs';
import {RichService, Service} from '../../domain/eic-model';
import {Paging} from '../../domain/paging';
import {URLParameter} from '../../domain/url-parameter';
import {SearchQuery} from '../../domain/search-query';
import {AuthenticationService} from '../../services/authentication.service';
import {ComparisonService} from '../../services/comparison.service';
import {NavigationService} from '../../services/navigation.service';
import {ResourceService} from '../../services/resource.service';
import {UserService} from '../../services/user.service';
import {zip} from 'rxjs/internal/observable/zip';
import {flatMap} from 'rxjs/operators';
import {PremiumSortFacetsPipe} from '../../shared/pipes/premium-sort.pipe';
import {OrderDownlineTreeviewEventParser, TreeviewConfig, TreeviewEventParser, TreeviewItem} from 'ngx-treeview';
import {EmailService} from '../../services/email.service';

declare var UIkit: any;

@Component({
  selector: 'app-search',
  styleUrls: ['./search.component.css'],
  templateUrl: './search.component.html',
  providers: [
    { provide: TreeviewEventParser, useClass: OrderDownlineTreeviewEventParser },
  ]
})

export class SearchComponent implements OnInit, OnDestroy {
  public serviceIdsArray: string[] = [];

  config = TreeviewConfig.create({
    hasAllCheckBox: false,
    hasFilter: false,
    hasCollapseExpand: false,
    decoupleChildFromParent: false,
    maxHeight: 300
  });
  items: TreeviewItem[] = [];
  scientificDomain: TreeviewItem[] = [];

  searchForm: FormGroup;
  errorMessage: string;
  sub: Subscription;
  urlParameters: URLParameter[] = [];
  searchResults: Paging<RichService>;
  facetOrder = ['category', 'trl', 'lifeCycleStatus', 'provider'];
  pageSize = 10;
  currentPage = 0;
  totalPages = 0;
  isPreviousPageDisabled = false;
  isFirstPageDisabled = false;
  isNextPageDisabled = false;
  isLastPageDisabled = false;
  foundResults = true;
  advanced = false;
  providers: any;
  loading = false;

  listViewActive = true;

  constructor(public fb: FormBuilder, public router: NavigationService, public route: ActivatedRoute,
              public userService: UserService, public resourceService: ResourceService,
              public authenticationService: AuthenticationService, public comparisonService: ComparisonService,
              public navigationService: NavigationService, public emailService: EmailService) {
    this.searchForm = fb.group({'query': ['']});
  }

  isChecked(serviceId: string) {
    return this.serviceIdsArray.indexOf(serviceId) > -1;
  }

  addOrRemove(serviceId: string) {
    const pos = this.serviceIdsArray.indexOf(serviceId);
    if (pos > -1) {
      this.serviceIdsArray.splice(pos, 1);
    } else {
      this.serviceIdsArray.push(serviceId);
    }
  }

  onSelectedChange(urlParams: any[], param) {
    let paramIndex = 0;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === param) {
        this.urlParameters.splice(paramIndex, 1);
        break;
      }
      paramIndex++;
    }
    for (let i = 0; i < urlParams.length; i++) {
      this.addParameterToURL(param, urlParams[i].item.value);
    }
    this.navigateUsingParameters();
  }

  ngOnInit() {
    this.listViewActive = true;

    zip(
      this.resourceService.getProvidersNames(),
    ).subscribe(suc => {
      this.providers = suc[0];
      // console.log(this.providers);
    });
    this.sub = this.route.params.subscribe(params => {
      this.urlParameters.splice(0, this.urlParameters.length);
      this.foundResults = true;
      let foundParamQuantity = false;
      for (const obj in params) {
        if (params.hasOwnProperty(obj)) {
          const urlParameter: URLParameter = {
            key: obj,
            values: params[obj].split(',')
          };
          this.urlParameters.push(urlParameter);
          if (urlParameter.key === 'quantity') {
            foundParamQuantity = true;
            this.pageSize = +urlParameter.values;
            if (this.pageSize % 3 === 0) {
              this.listViewActive = false;
            }
          }
        }
      }
      if (!foundParamQuantity) {
        this.urlParameters.push({key: 'quantity', values: [this.pageSize.toString() ]});
      }

      // if something breaks uncomment the following line
      // this.navigationService.paramsObservable.next(this.urlParameters);

      // request results from the registry
      this.loading = true;
      return this.resourceService.search(this.urlParameters).subscribe(
        searchResults => {
          this.updateSearchResults(searchResults);
          // console.log(searchResults.results);
          if (searchResults.facets.length !== 0 && this.items.length !== searchResults.facets[0].values.length) {
            this.categoryNestedCheckboxes(searchResults);
          }
          if (searchResults.facets.length !== 0 && this.scientificDomain.length !== searchResults.facets[2].values.length) {
            this.scientificDomainNestedCheckBoxes(searchResults);
          }
        },
        error => {},
        () => {
          this.loading = false;
        }
      );

    });
    // });
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    this.navigationService.paramsObservable.next(null);
  }

  toggleListGrid(show: string) {
    if (show === 'list') {
      this.listViewActive = true;
      this.pageSize = 10;
      this.updatePagingURLParametersQuantity(this.pageSize);
      this.updatePagingURLParameters(0);
      return this.navigateUsingParameters();
    } else if (show === 'grid') {
      this.listViewActive = false;
      this.pageSize = 9;
      this.updatePagingURLParametersQuantity(this.pageSize);
      this.updatePagingURLParameters(0);
      return this.navigateUsingParameters();
    } else {
      this.listViewActive = true;
      this.pageSize = 10;
      this.updatePagingURLParametersQuantity(this.pageSize);
      this.updatePagingURLParameters(0);
      return this.navigateUsingParameters();
    }
  }

  updateSearchResults(searchResults: Paging<RichService>) {

    // INITIALISATIONS
    const sortLanguages = new PremiumSortFacetsPipe();
    this.errorMessage = null;
    this.searchResults = searchResults;
    this.isFirstPageDisabled = false;
    this.isPreviousPageDisabled = false;
    this.isLastPageDisabled = false;
    this.isNextPageDisabled = false;
    if (this.searchResults.results.length === 0) {
      this.foundResults = false;
    } else {
      for (let i = 0; i < this.searchResults.facets.length; i++) {
        if (this.searchResults.facets[i].label === 'Language') {
          sortLanguages.transform(this.searchResults.facets[i].values, ['English']);
        } else {
          this.searchResults.facets[i].values.sort((a, b) => 0 - (a.label > b.label ? -1 : 1));
        }
      }
    }
    // this.orderFacets();
    // update form values using URLParameters
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === 'query') {
        this.searchForm.get('query').setValue(urlParameter.values[0]);
      } else if (urlParameter.key === 'advanced') {
        this.advanced = urlParameter.values[0] === 'true';
      } else {
        for (const facet of this.searchResults.facets) {
          if (facet.field === urlParameter.key) {
            //
            for (const parameterValue of urlParameter.values) {
              for (const facetValue of facet.values) {
                if (parameterValue === facetValue.value) {
                  facetValue.isChecked = true;
                }
              }
            }
          }
        }
      }
    }
    // this.pageSize = 10;
    this.updatePagingURLParametersQuantity(this.pageSize);
    this.currentPage = (searchResults.from / this.pageSize) + 1;
    this.totalPages = Math.ceil(searchResults.total / this.pageSize);
    if (this.currentPage === 1) {
      this.isFirstPageDisabled = true;
      this.isPreviousPageDisabled = true;
    }
    if (this.currentPage === this.totalPages) {
      this.isLastPageDisabled = true;
      this.isNextPageDisabled = true;
    }
  }

  categoryNestedCheckboxes(searchResults) {
    /** Checkbox Category structure!!!-->**/
    let subCategoriesArray: string[] = [];
    for (const param of this.urlParameters) {
      if (param.key === 'subcategories') {
        subCategoriesArray = param.values;
        break;
      }
    }
    this.items = [];
    let found = false;
    for (const superCategory of searchResults.facets[0].values) {
      found = false;
      const superCat = superCategory.value.split('-')[1];
      const categories: TreeviewItem[] = [];
      for (const category of searchResults.facets[1].values) {
        if (superCat === category.value.split('-')[1]) {
          const catId = category.value.split('-')[2];
          const subCategories: TreeviewItem[] = [];
          for (const subCategory of searchResults.facets[3].values) {
            if (catId === subCategory.value.split('-')[2]) {
              let checked = false;
              for (let i = 0; i < subCategoriesArray.length; i++) {
                if (subCategoriesArray[i] === subCategory.value) {
                  checked = true;
                  found = true;
                  break;
                }
              }
              subCategories.push(new TreeviewItem({
                text: subCategory.label + ` (${subCategory.count})`, value: subCategory.value, collapsed: true, checked: checked
              }));
            }
          }
          categories.push(new TreeviewItem({
            text: category.label /*+ ` (${category.count})`*/,
            value: category.value,
            children: subCategories,
            collapsed: !found,
            checked: false
          }));
        }
      }
      this.items.push(new TreeviewItem({
        text: superCategory.label /*+ ` (${superCategory.count})`*/,
        value: superCategory.value,
        children: categories,
        collapsed: !found,
        checked: false
      }));
    }
    /** <--Checkbox Category structure!!!**/
  }

  scientificDomainNestedCheckBoxes(searchResults) {
    /** Checkbox Scientific Domain structure!!!-->**/
    let subScientificDomainArray: string[] = [];
    for (const param of this.urlParameters) {
      if (param.key === 'scientific_subdomains') {
        subScientificDomainArray = param.values;
        break;
      }
    }
    this.scientificDomain = [];
    for (const domainValue of searchResults.facets[2].values) {
      const domainId = domainValue.value.split('-')[1];
      // console.log(domainId);
      const subDomain: TreeviewItem[] = [];
      for (const subDomainValue of searchResults.facets[5].values) {
        const subDomainId = subDomainValue.value.split('-')[1];
        let checked = false;
        for (let i = 0; i < subScientificDomainArray.length; i++) {
          if (subScientificDomainArray[i] === subDomainValue.value) {
            checked = true;
            break;
          }
        }
        // console.log(subDomainId);
        if (domainId === subDomainId) {
          subDomain.push(new TreeviewItem({
            text: subDomainValue.label + ` (${subDomainValue.count})`,
            value: subDomainValue.value,
            checked: checked,
            collapsed: true
          }));
        }
      }
      this.scientificDomain.push(new TreeviewItem({
        text: domainValue.label /*+ ` (${domainValue.count})`*/,
        value: domainValue.value,
        children: subDomain,
        checked: false,
        collapsed: true
      }));
    }
    /** <--Checkbox Scientific Domain structure!!!**/
  }

  orderFacets() {
    const facetValues = {};
    this.facetOrder.forEach((e, i) => {
      facetValues[e] = i;
    });
    this.searchResults.facets.sort((a, b): number => {
      return facetValues[a.field] - facetValues[b.field];
    });
  }

  onSubmit(searchValue: SearchQuery) {
    let foundQuery = false;
    let queryParameterIndex = 0;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === 'query') {
        foundQuery = true;
        if (searchValue.query === '') {
          this.urlParameters.splice(queryParameterIndex, 1);
        } else {
          urlParameter.values.splice(0, urlParameter.values.length);
          urlParameter.values.push(searchValue.query);
        }
      }
      queryParameterIndex++;
    }
    if (!foundQuery && searchValue.query !== '') {
      const searchQuery: URLParameter = {
        key: 'query',
        values: [searchValue.query]
      };
      this.urlParameters.push(searchQuery);
    }
    return this.navigateUsingParameters();
  }

  deselectFacet(category: string, value: string) {
    let categoryIndex = 0;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === category) {
        const valueIndex = urlParameter.values.indexOf(value, 0);
        if (valueIndex > -1) {
          this.updatePagingURLParameters(0);
          urlParameter.values.splice(valueIndex, 1);
          if (urlParameter.values.length === 0) {
            this.urlParameters.splice(categoryIndex, 1);
          }
        }
      }
      /** Handle nested checkboxes--> **/
      if (category === 'subcategories') {
        for (const i of this.items) {
          for (const j of i.children ) {
            for (const k of j.children ) {
              if (k.value === value) {
                k.checked = false;
              }
            }
          }
          i.correctChecked();
        }
      }
      if (category === 'scientific_subdomains') {
        for (const i of this.scientificDomain) {
          for (const j of i.children ) {
            if (j.value === value) {
              j.checked = false;
            }
          }
          i.correctChecked();
        }
      }
      /** <--Handle nested checkboxes **/
      categoryIndex++;
      if (category === 'query') {
        this.searchForm.get('query').setValue('');
        this.navigationService.paramsObservable.next(null);
      }
    }
    return this.navigateUsingParameters();
  }

  isSelected(service: Service): boolean {
    return (this.comparisonService.servicesToCompare.map(e => e.id).indexOf(service.id)) > -1;
  }

  selectFacet(category: string, value: string) {
    this.addParameterToURL(category, value);
    return this.navigateUsingParameters();
  }

  onSelection(e, category: string, value: string) {
    if (e.target.checked) {
      this.addParameterToURL(category, value);
    } else {
      let categoryIndex = 0;
      for (const urlParameter of this.urlParameters) {
        if (urlParameter.key === category) {
          const valueIndex = urlParameter.values.indexOf(value, 0);
          if (valueIndex > -1) {
            urlParameter.values.splice(valueIndex, 1);
            if (urlParameter.values.length === 0) {
              this.urlParameters.splice(categoryIndex, 1);
            }
          }
        }
        categoryIndex++;
      }
    }
    return this.navigateUsingParameters();
  }

  navigateUsingParameters() {
    const map: { [name: string]: string; } = {};
    for (const urlParameter of this.urlParameters) {
      map[urlParameter.key] = urlParameter.values.join(',');
    }
    // console.log(map);
    return this.router.search(map);
  }

  goToFirstPage() {
    const from = 0;
    // let to: number = 9;
    this.updatePagingURLParameters(from);
    return this.navigateUsingParameters();
  }

  goToPreviousPage() {
    let from: number = this.searchResults.from;
    // let to: number = this.searchResults.to;
    from -= this.pageSize;
    // to -= this.pageSize;
    this.updatePagingURLParameters(from);
    return this.navigateUsingParameters();
  }

  goToNextPage() {
    let from: number = this.searchResults.from;
    let to: number = this.searchResults.to;
    from += this.pageSize;
    to += this.pageSize;
    this.updatePagingURLParameters(from);
    return this.navigateUsingParameters();
  }

  goToLastPage() {
    const from: number = Math.floor(this.searchResults.total / this.pageSize) * this.pageSize;
    const to: number = this.searchResults.total - 1;
    this.updatePagingURLParameters(from);
    return this.navigateUsingParameters();
  }

  onPageSizeChange(event) {
    this.pageSize = event.target.value;
    this.updatePagingURLParametersQuantity(this.pageSize);
    this.updatePagingURLParameters(0);
    return this.navigateUsingParameters();
  }

  updatePagingURLParameters(from: number) {
    let foundFromCategory = false;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === 'from') {
        foundFromCategory = true;
        urlParameter.values = [];
        urlParameter.values.push(from + '');
        break;
      }
    }
    if (!foundFromCategory) {
      const newFromParameter: URLParameter = {
        key: 'from',
        values: [from + '']
      };
      this.urlParameters.push(newFromParameter);
    }
  }

  updatePagingURLParametersQuantity(quantity: number) {
    let foundQuantityCategory = false;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === 'quantity') {
        foundQuantityCategory = true;
        urlParameter.values = [];
        urlParameter.values.push(quantity + '');
      }
    }
    if (!foundQuantityCategory) {
      const newQuantityParameter: URLParameter = {
        key: 'quantity',
        values: [quantity + '']
      };
      this.urlParameters.push(newQuantityParameter);
    }
  }

  addToFavourites(i: number) {
    const richService = this.searchResults.results[i];
    this.userService.addFavourite(richService.service.id, !richService.isFavourite).pipe(
      flatMap(e => this.resourceService.getSelectedServices([e.service])))
      .subscribe(
        s => Object.assign(this.searchResults.results[i], s[0]),
        err => console.log(err)
      );

  }

  rateService(i: number, rating: number) {
    const richService = this.searchResults.results[i];
    this.userService.rateService(richService.service.id, rating).pipe(
      flatMap(e => this.resourceService.getSelectedServices([e.service])))
      .subscribe(
        s => Object.assign(this.searchResults.results[i], s[0]),
        err => console.log(err)
      );
  }

  getIsFavourite(i: number) {
    return this.searchResults.results[i].isFavourite;
  }

  private addParameterToURL(category: string, value: string) {
    let foundCategory = false;
    for (const urlParameter of this.urlParameters) {
      if (urlParameter.key === category) {
        foundCategory = true;
        const valueIndex = urlParameter.values.indexOf(value, 0);
        if (valueIndex < 0) {
          urlParameter.values.push(value);
          this.updatePagingURLParameters(0);
        }
      }
    }
    if (!foundCategory) {
      this.updatePagingURLParameters(0);
      const newParameter: URLParameter = {
        key: category,
        values: [value]
      };
      this.urlParameters.push(newParameter);
    }
  }

  getResourceOrganizationAbbreviation(service: RichService) {
    for (const providerInfo of service.providerInfo) {
      if (providerInfo.resourceOrganisation) {
        return providerInfo.providerAbbreviation;
      }
    }
    return null;
  }

}
